<?php

declare(strict_types=1);

namespace Flex;

use Dotenv\Dotenv;
use Flex\Updates\Platform\PlatformVersionRegistry;

final class Application
{
    private function __construct(
        private readonly string $basePath,
    ) {
    }

    public static function create(string $basePath): self
    {
        if (is_file($basePath . '/.env')) {
            Dotenv::createImmutable($basePath)->safeLoad();
        }

        return new self($basePath);
    }

    public function run(): never
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $version = (new PlatformVersionRegistry($this->basePath))->current()->value;

        if ($path === '/health') {
            $this->respond([
                'status' => 'ok',
                'application' => 'Flex CMS',
                'version' => $version,
            ]);
        }

        if (is_file($this->basePath . '/storage/maintenance.json')) {
            $this->respond([
                'status' => 'maintenance',
                'application' => 'Flex CMS',
                'version' => $version,
            ], 503);
        }

        $this->respond([
            'application' => 'Flex CMS',
            'status' => 'bootstrap-ready',
            'version' => $version,
        ]);
    }

    /** @param array<string, string> $payload */
    private function respond(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);

        exit;
    }
}
