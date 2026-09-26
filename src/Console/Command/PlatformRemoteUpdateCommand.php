<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Remote\RemotePlatformUpdater;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'platform:remote-update', description: 'Check and install the latest compatible platform release from the update server.')]
final class PlatformRemoteUpdateCommand extends Command
{
    public function __construct(private readonly RemotePlatformUpdater $updater)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, 'Download and validate the release without changing files.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        try {
            $result = $this->updater->update((bool) $input->getOption('dry-run'));
        } catch (\Throwable $exception) {
            $io->error($exception->getMessage());

            return self::FAILURE;
        }

        if ($result->installation->dryRun) {
            $io->success(sprintf('Remote package %s is valid for upgrading to %s.', $result->release->version->value, $result->installation->to->value));
        } else {
            $io->success(sprintf('Flex CMS was updated from %s to %s. Backup: %s', $result->installation->from->value, $result->installation->to->value, $result->installation->backupPath));
        }

        return self::SUCCESS;
    }
}
