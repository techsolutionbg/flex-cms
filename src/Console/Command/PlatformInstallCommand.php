<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Contracts\Updates\PlatformVersionInstallerInterface;
use Flex\Updates\Platform\PlatformInstallOptions;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'platform:install', description: 'Install a verified Flex CMS platform version package.')]
final class PlatformInstallCommand extends Command
{
    public function __construct(
        private readonly PlatformVersionInstallerInterface $installer,
        private readonly bool $requireChecksum,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('package', InputArgument::REQUIRED, 'Path to the platform ZIP package.')
            ->addOption('checksum', null, InputOption::VALUE_REQUIRED, 'Expected SHA-256 checksum.')
            ->addOption('allow-downgrade', null, InputOption::VALUE_NONE, 'Explicitly allow installing an older version.')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Validate the package without changing files.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $packagePath = $input->getArgument('package');
        $checksum = $input->getOption('checksum');
        if (!is_string($packagePath) || ($checksum !== null && !is_string($checksum))) {
            throw new \InvalidArgumentException('Invalid platform package arguments.');
        }

        $result = $this->installer->install($packagePath, new PlatformInstallOptions(
            expectedChecksum: $checksum,
            allowDowngrade: (bool) $input->getOption('allow-downgrade'),
            dryRun: (bool) $input->getOption('dry-run'),
            requireChecksum: $this->requireChecksum,
        ));

        if ($result->dryRun) {
            $io->success(sprintf('Package %s is valid for upgrading %s to %s.', $result->packageChecksum, $result->from, $result->to));
        } else {
            $io->success(sprintf('Flex CMS was updated from %s to %s. Backup: %s', $result->from, $result->to, $result->backupPath));
        }

        return self::SUCCESS;
    }
}
