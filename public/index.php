<?php

declare(strict_types=1);

use Flex\Application;
use Flex\Bootstrap;
use Flex\Installer\InstallationState;
use Flex\Installer\InstallerFactory;
use Flex\Http\SitePath;

require dirname(__DIR__) . '/vendor/autoload.php';

// Set before the installer branch, which runs without Bootstrap::boot().
date_default_timezone_set('UTC');

$basePath = dirname(__DIR__);
$path = SitePath::requestPath();
$installation = new InstallationState($basePath);

if ($path === '/install' || str_starts_with($path, '/install/')) {
    (new InstallerFactory())->create($basePath)->run();
}
if ($path === '/installer-api') {
    (new InstallerFactory())->create($basePath)->run();
}

if ($installation->requiresInstallation()) {
    header('Location: ' . SitePath::prefix() . '/install', true, 302);
    exit;
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$isThemePreview = preg_match('#^/admin/themes/[^/]+/preview$#', $path) === 1;
$isPluginEndpoint = preg_match('#^/admin/plugins/[a-z0-9._-]+/[a-z0-9._-]+/#', $path) === 1;
if (!$isThemePreview && !$isPluginEndpoint && in_array($method, ['GET', 'HEAD'], true)
    && ($path === '/admin' || str_starts_with($path, '/admin/') || $path === '/login')) {
    $adminEntry = $basePath . '/public/build/react-admin/index.html';
    if (!is_file($adminEntry)) {
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'The React Admin application has not been built.';
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store, private');
    $html = (string) file_get_contents($adminEntry);
    $sitePrefix = SitePath::prefix();
    if ($sitePrefix !== '') {
        $html = str_replace('/build/react-admin/', $sitePrefix . '/build/react-admin/', $html);
    }
    if ($method !== 'HEAD') {
        echo $html;
    }
    exit;
}

$container = Bootstrap::boot($basePath)->container();
$application = $container->get(Application::class);
if (!$application instanceof Application) {
    throw new RuntimeException('The application service is invalid.');
}
$application->run();
