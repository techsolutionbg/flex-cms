<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Jobs\UpdateJobStore;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'updates:status', description: 'Display queued and completed update jobs.')]
final class UpdateStatusCommand extends Command
{
    public function __construct(private readonly UpdateJobStore $jobs)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $rows = array_map(static fn($job): array => [$job->id, $job->type, $job->status, $job->createdAt, $job->finishedAt ?? ''], $this->jobs->all());
        (new SymfonyStyle($input, $output))->table(['ID', 'Type', 'Status', 'Created', 'Finished'], $rows);

        return self::SUCCESS;
    }
}
