<?php

declare(strict_types=1);

namespace Flex;

use Dotenv\Dotenv;

final class Application
{
    private function __construct()
    {
    }

    public static function create(string $basePath): self
    {
        if (is_file($basePath . '/.env')) {
            Dotenv::createImmutable($basePath)->safeLoad();
        }

        return new self();
    }

    public function run(): never
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        if ($path === '/health') {
            $this->respond([
                'status' => 'ok',
                'application' => 'Flex CMS',
            ]);
        }

        $this->respond([
            'application' => 'Flex CMS',
            'status' => 'bootstrap-ready',
        ]);
    }

    /** @param array<string, string> $payload */
    private function respond(array $payload): never
    {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);

        exit;
    }
}
