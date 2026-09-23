<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Extensions\PluginRegistry;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'plugin:list', description: 'List discovered and registered plugins.')]
final class PluginListCommand extends Command
{
    public function __construct(private readonly PluginRegistry $plugins)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $rows = [];
        foreach ($this->plugins->discover() as $entry) {
            $plugin = $this->plugins->find($entry['manifest']->id);
            $rows[] = [$entry['manifest']->id, $entry['manifest']->version, $plugin?->getAttribute('status') ?? 'discovered'];
        }
        $io->table(['ID', 'Version', 'Status'], $rows);

        return self::SUCCESS;
    }
}
