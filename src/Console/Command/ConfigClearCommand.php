<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Configuration\ConfigurationCache;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'config:clear', description: 'Remove the cached Flex CMS configuration.')]
final class ConfigClearCommand extends Command
{
    public function __construct(
        private readonly ConfigurationCache $cache,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        if (!$this->cache->clear()) {
            (new SymfonyStyle($input, $output))->error('The configuration cache could not be removed.');

            return self::FAILURE;
        }

        (new SymfonyStyle($input, $output))->success('The configuration cache was cleared.');

        return self::SUCCESS;
    }
}
