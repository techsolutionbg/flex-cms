<?php

declare(strict_types=1);

return [
    'default' => $_ENV['FILESYSTEM_DISK'] ?? 'local',
    'media' => [
        'disk' => $_ENV['MEDIA_DISK'] ?? 'public',
        'path' => $_ENV['MEDIA_PATH'] ?? 'public/media',
        'max_upload_mb' => (int) ($_ENV['MEDIA_MAX_UPLOAD_MB'] ?? 64),
        'image_driver' => $_ENV['IMAGE_DRIVER'] ?? 'gd',
    ],
];
