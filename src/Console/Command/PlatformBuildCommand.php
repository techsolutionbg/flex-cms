<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Platform\PlatformPackageBuilder;
use Flex\Updates\Platform\PlatformPackageBuildOptions;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'platform:build', description: 'Build a Flex CMS platform release ZIP package.')]
final class PlatformBuildCommand extends Command
{
    public function __construct(private readonly PlatformPackageBuilder $builder)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('target-version', null, InputOption::VALUE_REQUIRED, 'Target platform version.')
            ->addOption('compatible-from', null, InputOption::VALUE_REQUIRED, 'Platform version compatibility constraint.')
            ->addOption('minimum-php', null, InputOption::VALUE_REQUIRED, 'Minimum PHP version constraint.', '>=8.3')
            ->addOption('run-migrations', null, InputOption::VALUE_NONE, 'Mark the package as requiring migrations.')
            ->addOption('private-key-file', null, InputOption::VALUE_REQUIRED, 'Base64 Ed25519 release private key file.')
            ->addOption('key-id', null, InputOption::VALUE_REQUIRED, 'Optional release public key identifier.')
            ->addOption('output', null, InputOption::VALUE_REQUIRED, 'Output ZIP path.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        try {
            $result = $this->builder->build(new PlatformPackageBuildOptions(
                version: $this->stringOption($input, 'target-version'),
                compatibleFrom: $this->stringOption($input, 'compatible-from'),
                minimumPhp: (string) $input->getOption('minimum-php'),
                runMigrations: (bool) $input->getOption('run-migrations'),
                privateKeyPath: $this->stringOption($input, 'private-key-file'),
                keyId: $this->stringOption($input, 'key-id'),
                outputPath: $this->stringOption($input, 'output'),
            ));
        } catch (\Throwable $exception) {
            $io->error($exception->getMessage());
            return self::FAILURE;
        }

        $io->success('Platform release package built.');
        $io->definitionList(
            ['Path' => $result->path],
            ['Checksum' => $result->checksum],
            ['Checksum file' => $result->path . '.sha256'],
            ['Version' => $result->version],
            ['Files' => (string) $result->fileCount],
            ['Signed' => $result->signed ? 'yes' : 'no'],
        );

        return self::SUCCESS;
    }

    private function stringOption(InputInterface $input, string $name): ?string
    {
        $value = $input->getOption($name);
        return is_string($value) && $value !== '' ? $value : null;
    }
}
