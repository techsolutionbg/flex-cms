<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Platform\PlatformPackageInspector;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Helper\Table;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'platform:inspect', description: 'Validate and inspect a Flex CMS platform package.')]
final class PlatformInspectCommand extends Command
{
    public function __construct(
        private readonly PlatformPackageInspector $inspector,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('package', InputArgument::REQUIRED, 'Path to the platform ZIP package.')
            ->addOption('checksum', null, InputOption::VALUE_REQUIRED, 'Expected SHA-256 checksum.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $packagePath = $input->getArgument('package');
        $checksum = $input->getOption('checksum');
        if (!is_string($packagePath) || ($checksum !== null && !is_string($checksum))) {
            throw new \InvalidArgumentException('Invalid platform package arguments.');
        }

        $package = $this->inspector->inspect($packagePath, $checksum);
        (new Table($output))
            ->setRows([
                ['Version', $package->manifest->version->value],
                ['PHP', $package->manifest->minimumPhp],
                ['Compatible from', $package->manifest->compatibleFrom],
                ['Files', (string) count($package->manifest->files)],
                ['Remove', (string) count($package->manifest->remove)],
                ['Migrations', $package->manifest->runMigrations ? 'yes' : 'no'],
                ['Uncompressed bytes', (string) $package->uncompressedBytes],
                ['SHA-256', $package->checksum],
            ])
            ->render();

        return self::SUCCESS;
    }
}
