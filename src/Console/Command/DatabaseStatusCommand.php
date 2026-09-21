<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Database\DatabaseManager;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'database:status', description: 'Check the configured database connection.')]
final class DatabaseStatusCommand extends Command
{
    public function __construct(
        private readonly DatabaseManager $database,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $status = $this->database->status();
        $io = new SymfonyStyle($input, $output);

        if (!$status->connected) {
            $io->error(sprintf(
                'Database connection "%s" failed: %s',
                $status->connection,
                $status->error ?? 'Unknown error.',
            ));

            return self::FAILURE;
        }

        $io->success('The database connection is healthy.');
        $io->definitionList(
            ['Connection' => $status->connection],
            ['Database' => $status->database],
            ['Server version' => $status->serverVersion ?? 'unknown'],
            ['Latency' => sprintf('%.2f ms', $status->latencyMilliseconds)],
        );

        return self::SUCCESS;
    }
}
