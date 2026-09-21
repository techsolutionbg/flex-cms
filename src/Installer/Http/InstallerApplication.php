<?php

declare(strict_types=1);

namespace Flex\Installer\Http;

use Flex\Installer\Exception\InstallerException;
use Flex\Installer\InstallationState;
use Flex\Installer\InstallerInput;
use Flex\Installer\RequirementsChecker;
use Flex\Installer\WebInstaller;

final readonly class InstallerApplication
{
    public function __construct(
        private InstallationState $state,
        private RequirementsChecker $requirements,
        private WebInstaller $installer,
        private InstallerRenderer $renderer,
    ) {}

    public function run(): never
    {
        $this->securityHeaders();
        $this->startSession();

        if (!$this->state->requiresInstallation()) {
            $this->respond($this->renderer->unavailable(), 404);
        }

        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if ($method === 'GET') {
            $this->respond($this->renderer->form($this->requirements->check(), $this->csrfToken()));
        }
        if ($method !== 'POST') {
            header('Allow: GET, POST');
            $this->respond('Method not allowed.', 405, 'text/plain; charset=utf-8');
        }

        $values = $this->postValues();
        try {
            $this->verifyCsrf($values['csrf_token'] ?? '');
            $input = InstallerInput::fromArray($values);
            $this->installer->install($input);
            unset($_SESSION['flex_installer_csrf']);
            $this->respond($this->renderer->success($input->siteUrl));
        } catch (InstallerException $exception) {
            $safeValues = array_map(
                static fn(mixed $value): string => is_string($value) ? $value : '',
                $values,
            );
            unset($safeValues['database_password'], $safeValues['admin_password'], $safeValues['csrf_token']);
            $this->respond($this->renderer->form(
                $this->requirements->check(),
                $this->csrfToken(),
                $safeValues,
                $exception->getMessage(),
            ), 422);
        }
    }

    private function startSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        session_name('flex_installer');
        session_set_cookie_params([
            'httponly' => true,
            'secure' => ($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off',
            'samesite' => 'Strict',
            'path' => '/',
        ]);
        session_start();
    }

    private function csrfToken(): string
    {
        $token = $_SESSION['flex_installer_csrf'] ?? null;
        if (!is_string($token) || strlen($token) !== 64) {
            $token = bin2hex(random_bytes(32));
            $_SESSION['flex_installer_csrf'] = $token;
        }

        return $token;
    }

    private function verifyCsrf(string $token): void
    {
        if (!hash_equals($this->csrfToken(), $token)) {
            throw new InstallerException('The installation form expired. Reload the page and try again.');
        }
    }

    /** @return array<string, mixed> */
    private function postValues(): array
    {
        return $_POST;
    }

    private function securityHeaders(): void
    {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
        header('Cache-Control: no-store, private');
    }

    private function respond(string $body, int $status = 200, string $contentType = 'text/html; charset=utf-8'): never
    {
        http_response_code($status);
        header('Content-Type: ' . $contentType);
        echo $body;

        exit;
    }
}
