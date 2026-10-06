<?php

declare(strict_types=1);

return [
    // Actions remain separate so installations can grant capabilities independently.
    'permissions' => [
        'view' => ['super_admin'],
        'upload' => ['super_admin'],
        'edit' => ['super_admin'],
        'delete' => ['super_admin'],
    ],
];
