<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Jobs\UpdateJobStore;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'updates:queue', description: 'Queue a remote platform update job.')]
final class UpdateQueueCommand extends Command
{
    public function __construct(private readonly UpdateJobStore $jobs)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, 'Queue validation without changing files.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $job = $this->jobs->queuePlatformUpdate((bool) $input->getOption('dry-run'));
        (new SymfonyStyle($input, $output))->success(sprintf('Update job %s is %s.', $job->id, $job->status));

        return self::SUCCESS;
    }
}
