<?php

declare(strict_types=1);

namespace Flex\Installer\Http;

use Flex\Installer\Exception\InstallerException;
use Flex\Installer\InstallationState;
use Flex\Installer\InstallerInput;
use Flex\Installer\RequirementsChecker;
use Flex\Installer\WebInstaller;
use Flex\Http\SitePath;

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
            if ($this->wantsJson()) {
                $this->respondJson(['redirect_url' => $this->adminUrl()], 404);
            }

            $this->redirectToAdmin();
        }

        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if ($method === 'GET') {
            if ($this->wantsJson()) {
                $this->respondJson($this->renderer->data($this->csrfToken()));
            }
            $this->respond($this->renderer->reactApplication($this->requirements->check(), $this->csrfToken()));
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
            if ($this->wantsJson()) {
                $this->respondJson(['success' => true, 'admin_url' => $this->adminUrl()]);
            }
            $this->respond($this->renderer->success($this->adminUrl()));
        } catch (InstallerException $exception) {
            $safeValues = array_map(
                static fn(mixed $value): string => is_string($value) ? $value : '',
                $values,
            );
            unset($safeValues['database_password'], $safeValues['admin_password'], $safeValues['csrf_token']);
            if ($this->wantsJson()) {
                $this->respondJson(['error' => ['message' => $exception->getMessage()]], 422);
            }
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
        header("Content-Security-Policy: default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
        header('Cache-Control: no-store, private');
    }

    private function respond(string $body, int $status = 200, string $contentType = 'text/html; charset=utf-8'): never
    {
        http_response_code($status);
        header('Content-Type: ' . $contentType);
        echo $body;

        exit;
    }

    private function wantsJson(): bool
    {
        return str_contains(strtolower($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');
    }

    /** @param array<string, mixed> $payload */
    private function respondJson(array $payload, int $status = 200): never
    {
        $this->respond(json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $status, 'application/json; charset=utf-8');
    }

    private function redirectToAdmin(): never
    {
        header('Location: ' . $this->adminUrl(), true, 302);
        exit;
    }

    private function adminUrl(): string
    {
        $configured = $_ENV['ADMIN_URL'] ?? getenv('ADMIN_URL');
        if (!is_string($configured) || $configured === '') {
            return SitePath::prefix() . '/';
        }

        if (str_starts_with($configured, '/') && !str_starts_with($configured, '//')) {
            return $configured;
        }

        $parts = parse_url($configured);
        if (is_array($parts) && in_array($parts['scheme'] ?? '', ['http', 'https'], true) && is_string($parts['host'] ?? null)) {
            return $configured;
        }

        return SitePath::prefix() . '/';
    }
}
