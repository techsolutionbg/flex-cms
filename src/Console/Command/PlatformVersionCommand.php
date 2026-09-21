<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Platform\PlatformVersionRegistry;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'platform:version', description: 'Display the installed Flex CMS platform version.')]
final class PlatformVersionCommand extends Command
{
    public function __construct(
        private readonly PlatformVersionRegistry $versions,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $output->writeln($this->versions->current()->value);

        return self::SUCCESS;
    }
}
