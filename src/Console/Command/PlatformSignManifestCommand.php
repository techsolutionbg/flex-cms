<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Updates\Platform\PlatformPackageSignature;
use Flex\Updates\Platform\PlatformPackageManifest;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'platform:sign-manifest', description: 'Sign a platform manifest for release packaging.')]
final class PlatformSignManifestCommand extends Command
{
    public function __construct()
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('input', InputArgument::REQUIRED, 'Unsigned manifest JSON path.')
            ->addArgument('output', InputArgument::REQUIRED, 'Signed manifest JSON path.')
            ->addOption('private-key-file', null, InputOption::VALUE_REQUIRED, 'Base64 Ed25519 private key file.')
            ->addOption('key-id', null, InputOption::VALUE_REQUIRED, 'Optional public key identifier.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $source = $input->getArgument('input');
        $destination = $input->getArgument('output');
        $keyPath = $input->getOption('private-key-file');
        if (!is_string($source) || !is_string($destination) || !is_string($keyPath)) {
            $io->error('Input, output and private key file are required.');
            return self::FAILURE;
        }
        $contents = @file_get_contents($source);
        $privateKey = @file_get_contents($keyPath);
        if ($contents === false || $privateKey === false) {
            $io->error('The manifest or private key file cannot be read.');
            return self::FAILURE;
        }
        try {
            $manifest = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($manifest)) {
                throw new \RuntimeException('The manifest must be a JSON object.');
            }
            $manifest['signature_algorithm'] = PlatformPackageSignature::ALGORITHM;
            $keyId = $input->getOption('key-id');
            if (is_string($keyId) && $keyId !== '') {
                $manifest['key_id'] = $keyId;
            }
            PlatformPackageManifest::fromArray($manifest);
            $manifest['signature'] = PlatformPackageSignature::sign($manifest, trim($privateKey));
            $signed = json_encode($manifest, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL;
            if (file_put_contents($destination, $signed, LOCK_EX) === false) {
                throw new \RuntimeException('The signed manifest cannot be written.');
            }
        } catch (\Throwable $exception) {
            $io->error($exception->getMessage());
            return self::FAILURE;
        }
        $io->success(sprintf('Signed manifest written to %s.', $destination));

        return self::SUCCESS;
    }
}
