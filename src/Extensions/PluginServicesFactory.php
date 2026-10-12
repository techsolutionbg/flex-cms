<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Configuration\ProjectPaths;
use Flex\Database\DatabaseManager;
use Flex\Session\CsrfTokenManager;
use Flex\Themes\ThemeManager;
use Symfony\Component\Mailer\MailerInterface;

final readonly class PluginServicesFactory
{
    public function __construct(private DatabaseManager $database, private CsrfTokenManager $csrf, private MailerInterface $mailer, private ThemeManager $themes, private ProjectPaths $paths) {}

    /** @param list<string> $permissions */
    public function forPlugin(string $id, array $permissions): PluginServices
    {
        return new PluginServices($id, $permissions, $this->database, $this->csrf, $this->mailer, $this->themes, $this->paths);
    }
}
