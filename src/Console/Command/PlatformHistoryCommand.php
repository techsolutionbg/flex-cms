<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Platform\PlatformHistory;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'platform:history', description: 'Display platform update history.')]
final class PlatformHistoryCommand extends Command
{
    public function __construct(private readonly PlatformHistory $history)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $rows = [];
        foreach ($this->history->all() as $record) {
            $rows[] = [
                (string) ($record['type'] ?? 'unknown'),
                (string) ($record['id'] ?? '-'),
                (string) ($record['from'] ?? '-'),
                (string) ($record['to'] ?? '-'),
                ($record['migrations_ran'] ?? false) ? 'yes' : 'no',
                (string) ($record['installed_at'] ?? $record['rolled_back_at'] ?? '-'),
            ];
        }
        if ($rows === []) {
            $io->note('No platform updates have been recorded.');
            return self::SUCCESS;
        }
        $io->table(['Type', 'ID', 'From', 'To', 'Migrations', 'Date'], $rows);

        return self::SUCCESS;
    }
}
