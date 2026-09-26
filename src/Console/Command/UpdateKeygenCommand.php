<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'updates:keygen', description: 'Generate an Ed25519 signing key pair for update manifests.')]
final class UpdateKeygenCommand extends Command
{
    protected function configure(): void
    {
        $this
            ->addArgument('private-key-file', InputArgument::REQUIRED, 'Output file for the base64 private key.')
            ->addArgument('public-key-file', InputArgument::REQUIRED, 'Output file for the base64 public key.')
            ->addOption('force', null, InputOption::VALUE_NONE, 'Replace existing key files.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $privatePath = $input->getArgument('private-key-file');
        $publicPath = $input->getArgument('public-key-file');
        if (!is_string($privatePath) || !is_string($publicPath)) {
            $io->error('Both key file paths are required.');

            return self::FAILURE;
        }
        if (!$input->getOption('force') && (is_file($privatePath) || is_file($publicPath))) {
            $io->error('A key file already exists. Use --force only when rotating the keys intentionally.');

            return self::FAILURE;
        }

        $pair = sodium_crypto_sign_keypair();
        $private = base64_encode(sodium_crypto_sign_secretkey($pair)) . PHP_EOL;
        $public = base64_encode(sodium_crypto_sign_publickey($pair)) . PHP_EOL;
        if (file_put_contents($privatePath, $private, LOCK_EX) === false
            || file_put_contents($publicPath, $public, LOCK_EX) === false) {
            $io->error('The signing key files could not be written.');

            return self::FAILURE;
        }
        @chmod($privatePath, 0600);
        @chmod($publicPath, 0644);

        $io->success('Ed25519 signing key pair generated.');
        $io->warning('Keep the private key outside the repository and outside the public updates directory.');

        return self::SUCCESS;
    }
}
