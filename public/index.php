<?php

declare(strict_types=1);

use Flex\Application;

require dirname(__DIR__) . '/vendor/autoload.php';

$application = Application::create(dirname(__DIR__));
$application->run();
