<?php

declare(strict_types=1);

use Flex\Application;
use Flex\Bootstrap;
use Flex\Installer\InstallationState;
use Flex\Installer\InstallerFactory;

require dirname(__DIR__) . '/vendor/autoload.php';

$basePath = dirname(__DIR__);
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$installation = new InstallationState($basePath);

if ($path === '/install' || str_starts_with($path, '/install/')) {
    (new InstallerFactory())->create($basePath)->run();
}

if ($installation->requiresInstallation()) {
    header('Location: /install', true, 302);
    exit;
}

$container = Bootstrap::boot($basePath)->container();
$application = $container->get(Application::class);
if (!$application instanceof Application) {
    throw new RuntimeException('The application service is invalid.');
}
$application->run();
