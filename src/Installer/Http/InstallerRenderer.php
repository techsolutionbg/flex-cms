<?php

declare(strict_types=1);

namespace Flex\Installer\Http;

use Flex\Http\View\ViteAssetManager;

final readonly class InstallerRenderer
{
    private string $basePath;
    private ViteAssetManager $assets;

    public function __construct(?string $basePath = null)
    {
        $basePath ??= dirname(__DIR__, 3);
        $this->basePath = $basePath;
        $this->assets = new ViteAssetManager($basePath);
    }

    public function reactApplication(string $csrfToken): string
    {
        $tags = $this->assets->installerTags();
        if ($tags === '') {
            throw new \RuntimeException('The React installer build is missing. Build resources/admin-react before installation.');
        }

        return '<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Инсталация на Flex CMS</title>'
            . $tags
            . '</head><body><div id="root"></div><noscript>За инсталирането трябва да е включен JavaScript.</noscript></body></html>';
    }

    /** @param array<string, string> $values @return array{csrf_token: string, generated_password: string, sections: list<array{title: string, description: string, fields: list<array{name: string, label: string, value: string, type: string, placeholder: string}>}>} */
    public function data(string $csrfToken, array $values = [], ?string $error = null): array
    {
        // Never expose DB_PASSWORD from the environment in the rendered form.
        $databasePassword = '';
        $adminPassword = array_key_exists('admin_password', $values) ? '' : bin2hex(random_bytes(12));
        $field = static fn(string $name, string $label, string $value, string $type, string $placeholder): array => compact('name', 'label', 'value', 'type', 'placeholder');
        $sections = [
            ['title' => 'Уебсайт', 'description' => 'За домейн настройте HTTPS преди инсталацията. За локален XAMPP може да използвате HTTP.', 'fields' => [
                $field('site_name', 'Име на сайта', $values['site_name'] ?? 'Flex CMS', 'text', 'Моят нов сайт'),
                $field('site_url', 'Адрес на сайта', $values['site_url'] ?? $this->suggestedUrl(), 'url', 'https://example.com'),
                $field('timezone', 'Часова зона', $values['timezone'] ?? 'Europe/Sofia', 'text', 'Europe/Sofia'),
                $field('locale', 'Език', $values['locale'] ?? 'bg', 'text', 'bg'),
            ]],
            ['title' => 'MySQL база данни', 'description' => 'Създайте празна база и потребител с пълни права върху нея от контролния панел на хостинга. Поддържа се MySQL 8.0+ и MariaDB 10.4+. За XAMPP хостът обикновено е 127.0.0.1. Паролата може да е празна само ако MySQL потребителят няма парола.', 'fields' => [
                $field('database_host', 'Хост', $values['database_host'] ?? $this->configuredValue('DB_HOST', '127.0.0.1'), 'text', 'localhost или 127.0.0.1'),
                $field('database_port', 'Порт', $values['database_port'] ?? $this->configuredValue('DB_PORT', '3306'), 'number', '3306'),
                $field('database_name', 'База данни', $values['database_name'] ?? $this->configuredValue('DB_DATABASE', 'flex_cms'), 'text', 'flex_cms'),
                $field('database_username', 'Потребител', $values['database_username'] ?? $this->configuredValue('DB_USERNAME', 'flex_cms'), 'text', 'flex_cms'),
                $field('database_password', 'Парола', $databasePassword, 'password', 'Парола за MySQL'),
            ]],
            ['title' => 'Администратор', 'description' => 'Този профил ще има пълен достъп до платформата.', 'fields' => [
                $field('admin_name', 'Име и фамилия', $values['admin_name'] ?? 'Администратор', 'text', 'Администратор'),
                $field('admin_email', 'Имейл', $values['admin_email'] ?? 'admin@example.com', 'email', 'admin@example.com'),
                $field('admin_password', 'Парола', $adminPassword, 'password', 'Генерира се автоматично'),
            ]],
        ];

        return ['csrf_token' => $csrfToken, 'generated_password' => $adminPassword, 'sections' => $sections];
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
