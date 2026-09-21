<?php

declare(strict_types=1);

namespace Flex;

use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Updates\Platform\PlatformVersionRegistry;

final class Application
{
    public function __construct(
        private readonly ConfigRepositoryInterface $configuration,
        private readonly ProjectPaths $paths,
        private readonly PlatformVersionRegistry $versions,
    ) {
    }

    public function run(): never
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $version = $this->versions->current()->value;
        $applicationName = $this->configuration->string('app.name');

        if ($path === '/health') {
            $this->respond([
                'status' => 'ok',
                'application' => $applicationName,
                'version' => $version,
            ]);
        }

        if (is_file($this->paths->storage('maintenance.json'))) {
            $this->respond([
                'status' => 'maintenance',
                'application' => $applicationName,
                'version' => $version,
            ], 503);
        }

        $this->respond([
            'application' => $applicationName,
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
