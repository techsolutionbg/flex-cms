<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Configuration\ConfigurationCache;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'config:cache', description: 'Write the resolved configuration cache.')]
final class ConfigCacheCommand extends Command
{
    public function __construct(
        private readonly ConfigurationCache $cache,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $path = $this->cache->write();
        (new SymfonyStyle($input, $output))->success(sprintf('Configuration cached at %s.', $path));

        return self::SUCCESS;
    }
}
