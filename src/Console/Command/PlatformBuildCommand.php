<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Platform\PlatformPackageBuilder;
use Flex\Updates\Platform\PlatformPackageBuildOptions;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'platform:build', aliases: ['platform:release'], description: 'Build a Flex CMS platform release ZIP package.')]
final class PlatformBuildCommand extends Command
{
    public function __construct(
        private readonly PlatformPackageBuilder $builder,
        private readonly PlatformVersionRegistry $registry,
    )
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('target-version', null, InputOption::VALUE_REQUIRED, 'Target platform version. Defaults to the next patch version.')
            ->addOption('bump', null, InputOption::VALUE_REQUIRED, 'Version part to increase: major (1), minor (2) or patch (3). Defaults to patch when target-version is omitted.')
            ->addOption('compatible-from', null, InputOption::VALUE_REQUIRED, 'Platform version compatibility constraint.')
            ->addOption('minimum-php', null, InputOption::VALUE_REQUIRED, 'Minimum PHP version constraint.', '>=8.3')
            ->addOption('run-migrations', null, InputOption::VALUE_NONE, 'Mark the package as requiring migrations.')
            ->addOption('private-key-file', null, InputOption::VALUE_REQUIRED, 'Base64 Ed25519 release private key file. Defaults to UPDATE_SIGNING_PRIVATE_KEY_FILE or ~/.config/flex-cms/update-signing-private.key.')
            ->addOption('key-id', null, InputOption::VALUE_REQUIRED, 'Optional release public key identifier.', getenv('UPDATE_SIGNING_KEY_ID') ?: 'release-2026-v3')
            ->addOption('output', null, InputOption::VALUE_REQUIRED, 'Output ZIP path.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        try {
            $targetVersion = $this->stringOption($input, 'target-version');
            $bump = $this->stringOption($input, 'bump');
            if ($targetVersion !== null && $bump !== null) {
                throw new \RuntimeException('Use either --target-version or --bump, not both.');
            }

            $result = $this->builder->build(new PlatformPackageBuildOptions(
                version: $targetVersion ?? $this->bumpedVersion($bump ?? 'patch'),
                compatibleFrom: $this->stringOption($input, 'compatible-from'),
                minimumPhp: (string) $input->getOption('minimum-php'),
                runMigrations: (bool) $input->getOption('run-migrations'),
                privateKeyPath: $this->privateKeyPath($input),
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

    private function bumpedVersion(string $bump): string
    {
        $bump = match (strtolower(trim($bump))) {
            '1', 'major' => 'major',
            '2', 'minor' => 'minor',
            '3', 'patch' => 'patch',
            default => throw new \RuntimeException('Invalid --bump value. Use major (1), minor (2) or patch (3).'),
        };
        $version = $this->registry->current()->value;
        if (preg_match('/^(\d+)\.(\d+)\.(\d+)$/', $version, $matches) !== 1) {
            throw new \RuntimeException(sprintf('Current platform version "%s" is not a stable MAJOR.MINOR.PATCH version.', $version));
        }

        [$major, $minor, $patch] = array_map('intval', array_slice($matches, 1));
        if ($bump === 'major') {
            return sprintf('%d.0.0', $major + 1);
        }
        if ($bump === 'minor') {
            return sprintf('%d.%d.0', $major, $minor + 1);
        }

        return sprintf('%d.%d.%d', $major, $minor, $patch + 1);
    }

    private function privateKeyPath(InputInterface $input): ?string
    {
        $explicit = $this->stringOption($input, 'private-key-file');
        if ($explicit !== null) {
            return $explicit;
        }

        $configured = getenv('UPDATE_SIGNING_PRIVATE_KEY_FILE');
        if (is_string($configured) && $configured !== '' && is_file($configured)) {
            return $configured;
        }

        $home = getenv('HOME');
        $default = is_string($home) && $home !== '' ? $home . '/.config/flex-cms/update-signing-private.key' : '';

        return $default !== '' && is_file($default) ? $default : null;
    }
}
