<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Extensions\PluginManager;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'plugin:uninstall', description: 'Remove an inactive plugin and its registered data.')]
final class PluginUninstallCommand extends Command
{
    public function __construct(private readonly PluginManager $plugins)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('id', InputArgument::REQUIRED, 'Plugin ID, for example vendor/plugin.')
            ->addOption('force', null, InputOption::VALUE_NONE, 'Confirm the destructive uninstall.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        if (!(bool) $input->getOption('force')) {
            $io->error('Uninstall removes the plugin files. Re-run with --force after verifying the plugin ID.');
            return self::FAILURE;
        }
        try {
            $this->plugins->uninstall((string) $input->getArgument('id'));
        } catch (\Throwable $exception) {
            $io->error($exception->getMessage());
            return self::FAILURE;
        }
        $io->success(sprintf('Plugin %s was uninstalled.', $input->getArgument('id')));

        return self::SUCCESS;
    }
}
