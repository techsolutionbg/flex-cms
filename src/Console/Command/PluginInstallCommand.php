<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Extensions\PluginManager;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'plugin:install', description: 'Register a plugin found in the plugins directory.')]
final class PluginInstallCommand extends Command
{
    public function __construct(private readonly PluginManager $plugins)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('id', InputArgument::REQUIRED, 'Plugin ID, for example vendor/plugin.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        try {
            $plugin = $this->plugins->install((string) $input->getArgument('id'));
        } catch (\Throwable $exception) {
            $io->error($exception->getMessage());
            return self::FAILURE;
        }
        $io->success(sprintf('Plugin %s %s was installed.', $plugin->getAttribute('id'), $plugin->getAttribute('version')));

        return self::SUCCESS;
    }
}
