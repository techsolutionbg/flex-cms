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

#[AsCommand(name: 'plugin:activate', description: 'Activate an installed plugin.')]
final class PluginActivateCommand extends Command
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
            $plugin = $this->plugins->activate((string) $input->getArgument('id'));
        } catch (\Throwable $exception) {
            $io->error($exception->getMessage());
            return self::FAILURE;
        }
        $io->success(sprintf('Plugin %s is active.', $plugin->getAttribute('id')));

        return self::SUCCESS;
    }
}
