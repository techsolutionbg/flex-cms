<?php

declare(strict_types=1);

return [
    'config' => 'config',
    'storage' => 'storage',
    'plugins' => $_ENV['PLUGINS_PATH'] ?? 'plugins',
    'themes' => $_ENV['THEMES_PATH'] ?? 'themes',
    'public_media' => $_ENV['MEDIA_PATH'] ?? 'public/media',
];
