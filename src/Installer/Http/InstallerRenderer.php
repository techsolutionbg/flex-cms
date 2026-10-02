<?php

declare(strict_types=1);

namespace Flex\Installer\Http;

use Flex\Http\View\TwigViewRenderer;
use Flex\Http\View\ViteAssetManager;
use Flex\Installer\RequirementsReport;

final readonly class InstallerRenderer
{
    private string $basePath;
    private TwigViewRenderer $views;
    private ViteAssetManager $assets;

    public function __construct(?string $basePath = null)
    {
        $basePath ??= dirname(__DIR__, 3);
        $this->basePath = $basePath;
        $this->views = new TwigViewRenderer($basePath);
        $this->assets = new ViteAssetManager($basePath);
    }

    /** @param array<string, string> $values */
    public function form(RequirementsReport $report, string $csrfToken, array $values = [], ?string $error = null): string
    {
        $data = $this->data($csrfToken, $values, $error);

        return $this->views->render('installer/form.twig', ['csrf_token' => $csrfToken, 'error' => $error, 'sections' => $data['sections'], 'generated_password' => $data['generated_password'], 'vite_tags' => $this->assets->tags(), 'vite_styles' => $this->assets->styles()]);
    }

    /** @param array<string, string> $values @return array{csrf_token: string, generated_password: string, sections: list<array{title: string, description: string, fields: list<array{name: string, label: string, value: string, type: string, placeholder: string}>}>} */
    public function data(string $csrfToken, array $values = [], ?string $error = null): array
    {
        // Never expose DB_PASSWORD from the environment in the rendered form.
        $databasePassword = '';
        $adminPassword = array_key_exists('admin_password', $values) ? '' : bin2hex(random_bytes(12));
        $field = static fn(string $name, string $label, string $value, string $type, string $placeholder): array => compact('name', 'label', 'value', 'type', 'placeholder');
        $sections = [
            ['title' => 'Website', 'description' => 'The public identity and regional defaults.', 'fields' => [
                $field('site_name', 'Site name', $values['site_name'] ?? 'Flex CMS', 'text', 'My new website'),
                $field('site_url', 'Site URL', $values['site_url'] ?? $this->suggestedUrl(), 'url', 'https://example.com'),
                $field('timezone', 'Timezone', $values['timezone'] ?? 'Europe/Sofia', 'text', 'Europe/Sofia'),
                $field('locale', 'Locale', $values['locale'] ?? 'bg', 'text', 'bg'),
            ]],
            ['title' => 'MySQL database', 'description' => 'Use an empty MySQL 8 database and a user with schema permissions.', 'fields' => [
                $field('database_host', 'Host', $values['database_host'] ?? $this->configuredValue('DB_HOST', 'localhost'), 'text', 'mysql'),
                $field('database_port', 'Port', $values['database_port'] ?? $this->configuredValue('DB_PORT', '3306'), 'number', '3306'),
                $field('database_name', 'Database', $values['database_name'] ?? $this->configuredValue('DB_DATABASE', 'flex_cms'), 'text', 'flex_cms'),
                $field('database_username', 'Username', $values['database_username'] ?? $this->configuredValue('DB_USERNAME', 'flex_cms'), 'text', 'flex_cms'),
                $field('database_password', 'Password', $databasePassword, 'password', 'Database password'),
            ]],
            ['title' => 'Administrator', 'description' => 'This account receives full platform access.', 'fields' => [
                $field('admin_name', 'Full name', $values['admin_name'] ?? 'Administrator', 'text', 'Administrator'),
                $field('admin_email', 'Email', $values['admin_email'] ?? 'admin@example.com', 'email', 'admin@example.com'),
                $field('admin_password', 'Password', $adminPassword, 'password', 'Generated automatically'),
            ]],
        ];

        return ['csrf_token' => $csrfToken, 'generated_password' => $adminPassword, 'sections' => $sections];
    }

    public function success(string $siteUrl): string
    {
        return $this->status('Flex CMS is ready', 'Your foundation is ready.', 'Flex CMS, the database schema and your administrator account were created successfully.', $siteUrl, 'Open the website');
    }
    public function unavailable(): string
    {
        return $this->status('Installer unavailable', 'The installer is locked.', 'This installation is already configured.', '/', 'Return to the website');
    }

    private function status(string $title, string $heading, string $message, string $url, string $action): string
    {
        return $this->views->render('installer/status.twig', compact('title', 'heading', 'message', 'url', 'action') + ['vite_tags' => $this->assets->tags()]);
    }

    private function suggestedUrl(): string
    {
        $configuredUrl = $_SERVER['HTTP_X_FLEX_INSTALLER_SITE_URL'] ?? '';
        if (is_string($configuredUrl) && filter_var($configuredUrl, FILTER_VALIDATE_URL)) {
            return rtrim($configuredUrl, '/');
        }

        $host = preg_replace('/[^a-zA-Z0-9.:[\]-]/', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
        $scheme = ($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off' ? 'https' : 'http';
        return $scheme . '://' . ($host ?: 'localhost');
    }

    private function configuredValue(string $key, string $fallback): string
    {
        $value = $_ENV[$key] ?? getenv($key);
        if (is_string($value) && $value !== '') {
            return $value;
        }

        $environment = @parse_ini_file($this->basePath . '/.env', false, INI_SCANNER_RAW);
        $value = is_array($environment) ? ($environment[$key] ?? null) : null;

        return is_string($value) && $value !== '' ? trim($value, " \\t\\\"") : $fallback;
    }
}
