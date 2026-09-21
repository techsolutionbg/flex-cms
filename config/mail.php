<?php

declare(strict_types=1);

return [
    'dsn' => $_ENV['MAILER_DSN'] ?? 'null://null',
    'from' => [
        'address' => $_ENV['MAIL_FROM_ADDRESS'] ?? 'noreply@localhost',
        'name' => $_ENV['MAIL_FROM_NAME'] ?? 'Flex CMS',
    ],
];
