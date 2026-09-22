<?php

declare(strict_types=1);

namespace Flex\Installer\Http;

use Flex\Http\View\TwigViewRenderer;
use Flex\Http\View\ViteAssetManager;
use Flex\Installer\RequirementsReport;

final readonly class InstallerRenderer
{
    private TwigViewRenderer $views;
    private ViteAssetManager $assets;

    public function __construct(?string $basePath = null)
    {
        $basePath ??= dirname(__DIR__, 3);
        $this->views = new TwigViewRenderer($basePath);
        $this->assets = new ViteAssetManager($basePath);
    }

    /** @param array<string, string> $values */
    public function form(RequirementsReport $report, string $csrfToken, array $values = [], ?string $error = null): string
    {
        $databasePassword = array_key_exists('database_password', $values) ? '' : 'flex_cms';
        $adminPassword = array_key_exists('admin_password', $values) ? '' : bin2hex(random_bytes(12));
        $field = static fn (string $name, string $label, string $value, string $type, string $placeholder): array => compact('name', 'label', 'value', 'type', 'placeholder');
        $sections = [
            ['title' => 'Website', 'description' => 'The public identity and regional defaults.', 'fields' => [
                $field('site_name', 'Site name', $values['site_name'] ?? 'Flex CMS', 'text', 'My new website'),
                $field('site_url', 'Site URL', $values['site_url'] ?? $this->suggestedUrl(), 'url', 'https://example.com'),
                $field('timezone', 'Timezone', $values['timezone'] ?? 'Europe/Sofia', 'text', 'Europe/Sofia'),
                $field('locale', 'Locale', $values['locale'] ?? 'bg', 'text', 'bg'),
            ]],
            ['title' => 'MySQL database', 'description' => 'Use an empty MySQL 8 database and a user with schema permissions.', 'fields' => [
                $field('database_host', 'Host', $values['database_host'] ?? 'localhost', 'text', 'localhost'),
                $field('database_port', 'Port', $values['database_port'] ?? '3306', 'number', '3306'),
                $field('database_name', 'Database', $values['database_name'] ?? 'flex_cms', 'text', 'flex_cms'),
                $field('database_username', 'Username', $values['database_username'] ?? 'flex_cms', 'text', 'flex_cms'),
                $field('database_password', 'Password', $databasePassword, 'password', 'flex_cms'),
            ]],
            ['title' => 'Administrator', 'description' => 'This account receives full platform access.', 'fields' => [
                $field('admin_name', 'Full name', $values['admin_name'] ?? 'Administrator', 'text', 'Administrator'),
                $field('admin_email', 'Email', $values['admin_email'] ?? 'admin@example.com', 'email', 'admin@example.com'),
                $field('admin_password', 'Password', $adminPassword, 'password', 'Generated automatically'),
            ]],
        ];

        return $this->views->render('installer/form.twig', ['csrf_token' => $csrfToken, 'error' => $error, 'sections' => $sections, 'generated_password' => $adminPassword, 'vite_tags' => $this->assets->tags()]);
    }

    public function success(string $siteUrl): string { return $this->status('Flex CMS is ready', 'Your foundation is ready.', 'Flex CMS, the database schema and your administrator account were created successfully.', $siteUrl, 'Open the website'); }
    public function unavailable(): string { return $this->status('Installer unavailable', 'The installer is locked.', 'This installation is already configured.', '/', 'Return to the website'); }

    private function status(string $title, string $heading, string $message, string $url, string $action): string
    {
        return $this->views->render('installer/status.twig', compact('title', 'heading', 'message', 'url', 'action') + ['vite_tags' => $this->assets->tags()]);
    }

    private function suggestedUrl(): string
    {
        $host = preg_replace('/[^a-zA-Z0-9.:[\]-]/', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
        $scheme = ($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off' ? 'https' : 'http';
        return $scheme . '://' . ($host ?: 'localhost');
    }
}
