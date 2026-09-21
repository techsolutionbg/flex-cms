<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Platform\PlatformUpdateRecovery;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'platform:recover', description: 'Recover an interrupted platform update from its backup.')]
final class PlatformRecoverCommand extends Command
{
    public function __construct(private readonly PlatformUpdateRecovery $recovery)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        try {
            $state = $this->recovery->recover();
        } catch (\Throwable $exception) {
            $io->error($exception->getMessage());

            return self::FAILURE;
        }

        $io->success(sprintf('The interrupted platform update from %s to %s was recovered.', $state->from, $state->to));

        return self::SUCCESS;
    }
}
