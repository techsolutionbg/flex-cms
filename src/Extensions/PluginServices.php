<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Configuration\ProjectPaths;
use Flex\Database\DatabaseManager;
use Flex\Extension\V1\PluginServicesInterface;
use Flex\Extension\V1\PluginStorageInterface;
use Flex\Extensions\Exception\PluginPermissionDenied;
use Flex\Session\CsrfTokenManager;
use Flex\Themes\ThemeManager;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;

final readonly class PluginServices implements PluginServicesInterface
{
    /** @param list<string> $permissions */
    public function __construct(private string $id, private array $permissions, private DatabaseManager $database, private CsrfTokenManager $csrf, private MailerInterface $mailer, private ThemeManager $themes, private ProjectPaths $paths) {}

    public function storage(): PluginStorageInterface
    {
        $this->requirePermission('storage.documents');
        return new PluginDocumentStorage($this->database->connection(), $this->id);
    }

    public function csrfToken(): string
    {
        return $this->csrf->token();
    }

    public function validateCsrf(string $token): bool
    {
        return $this->csrf->validate($token);
    }

    public function sendMail(array $recipients, string $subject, string $text, ?string $replyTo = null): void
    {
        $this->requirePermission('mail.send');
        if ($recipients === [] || count($recipients) > 10 || str_contains($subject, "\r") || str_contains($subject, "\n")) {
            throw new \InvalidArgumentException('Invalid mail envelope.');
        }
        foreach ([...$recipients, ...($replyTo === null ? [] : [$replyTo])] as $address) {
            if (filter_var($address, FILTER_VALIDATE_EMAIL) === false) {
                throw new \InvalidArgumentException('Invalid email.');
            }
        }
        $email = (new Email())->to(...$recipients)->subject($subject)->text($text);
        if ($replyTo !== null) {
            $email->replyTo($replyTo);
        }
        $this->mailer->send($email);
    }

    public function themeExtension(): ?array
    {
        $this->requirePermission('theme.extensions');
        $id = $this->themes->activeTheme();
        if ($id === '') {
            return null;
        }
        $root = $this->themeRoot();
        if (!is_file($root . '/theme.json')) {
            return null;
        }
        $manifestPath = $this->resolve($root, 'theme.json');
        if (!is_file($manifestPath)) {
            return null;
        }
        $manifest = json_decode((string) file_get_contents($manifestPath), true, 32, JSON_THROW_ON_ERROR);
        $path = $manifest['extensions'][$this->id] ?? null;
        if ($path === null) {
            return null;
        }
        if (!is_string($path)) {
            throw new \RuntimeException('Invalid theme extension declaration.');
        }
        $descriptor = json_decode((string) file_get_contents($this->resolve($root, $path)), true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($descriptor) || ($descriptor['version'] ?? null) !== 1) {
            throw new \RuntimeException('Unsupported theme extension contract.');
        }
        /** @var array<string, mixed> $descriptor */
        return ['id' => $id, 'descriptor' => $descriptor];
    }

    public function renderThemeTemplate(string $relativePath, array $data): string
    {
        $this->requirePermission('theme.extensions');
        $root = $this->themeRoot();
        $path = $this->resolve($root, $relativePath);
        if (str_ends_with($path, '.twig')) {
            return (new Environment(new FilesystemLoader($root), ['strict_variables' => true, 'autoescape' => 'html']))->render($relativePath, $data);
        }
        if (!str_ends_with($path, '.php')) {
            throw new \RuntimeException('Only PHP and Twig templates are supported.');
        }
        ob_start();
        try {
            // Do not expose the platform service object as $this to a template.
            (static function (string $file, array $view): void {
                extract($view, EXTR_SKIP);
                include $file;
            })($path, $data);
            return (string) ob_get_clean();
        } catch (\Throwable $error) {
            ob_end_clean();
            throw $error;
        }
    }

    private function themeRoot(): string
    {
        $id = $this->themes->activeTheme();
        if (preg_match('/^[a-z0-9][a-z0-9._-]*$/D', $id) !== 1) {
            throw new \RuntimeException('Invalid active theme.');
        }
        $base = realpath($this->paths->themes());
        $root = realpath($this->paths->themes($id));
        if ($base === false || $root === false || !str_starts_with(str_replace('\\', '/', $root) . '/', str_replace('\\', '/', $base) . '/')) {
            throw new \RuntimeException('Invalid theme directory.');
        }
        return $root;
    }

    private function resolve(string $root, string $relative): string
    {
        if ($relative === '' || str_contains($relative, '\\') || str_contains($relative, ':') || str_starts_with($relative, '/') || in_array('..', explode('/', $relative), true)) {
            throw new \RuntimeException('Invalid theme extension path.');
        }
        $path = realpath($root . '/' . $relative);
        if ($path === false || !is_file($path) || !str_starts_with(str_replace('\\', '/', $path), str_replace('\\', '/', $root) . '/')) {
            throw new \RuntimeException('Theme extension file is missing or outside the theme.');
        }
        return $path;
    }

    private function requirePermission(string $permission): void
    {
        if (!in_array($permission, $this->permissions, true)) {
            throw new PluginPermissionDenied('Missing permission: ' . $permission);
        }
    }
}
