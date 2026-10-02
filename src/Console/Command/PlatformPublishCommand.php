<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Platform\PlatformVersionRegistry;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'platform:publish', description: 'Build and publish a Flex CMS platform release to the update host.')]
final class PlatformPublishCommand extends Command
{
    public function __construct(private readonly PlatformVersionRegistry $registry)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('target-version', null, InputOption::VALUE_REQUIRED, 'Target platform version. Defaults to the next patch version.')
            ->addOption('bump', null, InputOption::VALUE_REQUIRED, 'Version part to increase: major (1), minor (2) or patch (3).')
            ->addOption('release-notes', null, InputOption::VALUE_REQUIRED, 'Release notes published in the update catalog.', '')
            ->addOption('private-key-file', null, InputOption::VALUE_REQUIRED, 'Base64 Ed25519 release private key file.')
            ->addOption('key-id', null, InputOption::VALUE_REQUIRED, 'Release public key identifier.')
            ->addOption('compatible-from', null, InputOption::VALUE_REQUIRED, 'Platform version compatibility constraint.')
            ->addOption('run-migrations', null, InputOption::VALUE_NONE, 'Mark the package as requiring migrations.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $targetVersion = $this->stringOption($input, 'target-version');
        $bump = $this->stringOption($input, 'bump');
        if ($targetVersion !== null && $bump !== null) {
            $io->error('Use either --target-version or --bump, not both.');
            return self::FAILURE;
        }

        try {
            $version = $targetVersion ?? $this->bumpedVersion($bump ?? 'patch');
        } catch (\Throwable $exception) {
            $io->error($exception->getMessage());
            return self::FAILURE;
        }

        $key = $this->privateKeyPath($input);
        if ($key === null) {
            $io->error('A signing key is required. Set UPDATE_SIGNING_PRIVATE_KEY_FILE or pass --private-key-file.');
            return self::FAILURE;
        }

        $root = dirname(__DIR__, 3);
        $script = $root . '/scripts/publish_update.sh';
        if (!is_file($script) || !is_executable($script)) {
            $io->error(sprintf('The publish script is missing or not executable: %s', $script));
            return self::FAILURE;
        }

        $command = [$script, $version, (string) $input->getOption('release-notes'), $key];
        if ((bool) $input->getOption('run-migrations')) {
            $command[] = '--run-migrations';
        }
        $environment = array_merge(getenv(), array_filter([
            'UPDATE_SIGNING_KEY_ID' => $this->stringOption($input, 'key-id'),
            'UPDATE_COMPATIBLE_FROM' => $this->stringOption($input, 'compatible-from'),
        ]));
        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $root, $environment);
        if (!is_resource($process)) {
            $io->error('The publish process could not be started.');
            return self::FAILURE;
        }

        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);
        if ($stdout !== false && $stdout !== '') {
            $output->write($stdout);
        }
        if ($exitCode !== 0) {
            if ($stderr !== false && $stderr !== '') {
                $output->write($stderr, false, OutputInterface::VERBOSITY_NORMAL);
            }
            $io->error(sprintf('Publishing platform %s failed.', $version));
            return self::FAILURE;
        }

        $io->success(sprintf('Platform %s was built and published.', $version));
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
        return match ($bump) {
            'major' => sprintf('%d.0.0', $major + 1),
            'minor' => sprintf('%d.%d.0', $major, $minor + 1),
            default => sprintf('%d.%d.%d', $major, $minor, $patch + 1),
        };
    }

    private function privateKeyPath(InputInterface $input): ?string
    {
        $explicit = $this->stringOption($input, 'private-key-file');
        if ($explicit !== null && is_file($explicit)) {
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
