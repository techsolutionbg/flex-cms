<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Platform\PlatformRollback;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'platform:rollback', description: 'Roll back a platform update using its backup.')]
final class PlatformRollbackCommand extends Command
{
    public function __construct(private readonly PlatformRollback $rollback)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('id', InputArgument::REQUIRED, 'Backup/update ID from platform:history.')
            ->addOption('force', null, InputOption::VALUE_NONE, 'Confirm the destructive rollback.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        if (!(bool) $input->getOption('force')) {
            $io->error('Rollback changes application files. Re-run with --force after verifying the backup ID.');
            return self::FAILURE;
        }
        $id = $input->getArgument('id');
        if (!is_string($id) || $id === '') {
            $io->error('A valid update ID is required.');
            return self::FAILURE;
        }
        try {
            $record = $this->rollback->rollback($id);
        } catch (\Throwable $exception) {
            $io->error($exception->getMessage());
            return self::FAILURE;
        }
        $io->success(sprintf('Platform update %s was rolled back from %s to %s.', $id, $record['to'], $record['from']));

        return self::SUCCESS;
    }
}
