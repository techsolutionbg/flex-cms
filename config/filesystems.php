<?php

declare(strict_types=1);

return [
    'default' => $_ENV['FILESYSTEM_DISK'] ?? 'local',
    'media' => [
        'disk' => $_ENV['MEDIA_DISK'] ?? 'public',
        'path' => $_ENV['MEDIA_PATH'] ?? 'public/media',
        'max_upload_mb' => (int) ($_ENV['MEDIA_MAX_UPLOAD_MB'] ?? 64),
        'max_image_megapixels' => (int) ($_ENV['MEDIA_MAX_IMAGE_MEGAPIXELS'] ?? 48),
        'image_driver' => $_ENV['IMAGE_DRIVER'] ?? 'gd',
    ],
];
