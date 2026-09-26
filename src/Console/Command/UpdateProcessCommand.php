<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Jobs\UpdateJobProcessor;
use Flex\Updates\Jobs\UpdateJobStore;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'updates:process', description: 'Process one queued update job.')]
final class UpdateProcessCommand extends Command
{
    public function __construct(private readonly UpdateJobProcessor $processor)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $job = $this->processor->processNext();
        if ($job === null) {
            $io->text('No queued update jobs.');

            return self::SUCCESS;
        }
        if ($job->status === UpdateJobStore::STATUS_FAILED) {
            $io->error(sprintf('Update job %s failed: %s', $job->id, $job->error ?? 'unknown error'));

            return self::FAILURE;
        }
        $io->success(sprintf('Update job %s completed.', $job->id));

        return self::SUCCESS;
    }
}
