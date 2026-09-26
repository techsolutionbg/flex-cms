<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Remote\PluginRollback;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'plugin:rollback', description: 'Rollback a plugin to its previous remote release.')]
final class PluginRollbackCommand extends Command
{
    public function __construct(private readonly PluginRollback $rollback) { parent::__construct(); }

    protected function configure(): void { $this->addArgument('id', InputArgument::REQUIRED, 'Plugin update history ID.'); }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $record = $this->rollback->rollback((string) $input->getArgument('id'));
        (new SymfonyStyle($input, $output))->success(sprintf('Plugin %s was rolled back.', (string) ($record['plugin_id'] ?? '')));

        return self::SUCCESS;
    }
}
