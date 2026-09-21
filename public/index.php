<?php

declare(strict_types=1);

use Flex\Application;
use Flex\Bootstrap;

require dirname(__DIR__) . '/vendor/autoload.php';

$container = Bootstrap::boot(dirname(__DIR__))->container();
$application = $container->get(Application::class);
if (!$application instanceof Application) {
    throw new RuntimeException('The application service is invalid.');
}
$application->run();
