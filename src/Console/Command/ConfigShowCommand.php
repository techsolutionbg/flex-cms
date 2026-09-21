<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Configuration\ConfigurationRedactor;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'config:show', description: 'Display the resolved Flex CMS configuration.')]
final class ConfigShowCommand extends Command
{
    public function __construct(
        private readonly ConfigRepositoryInterface $configuration,
        private readonly ConfigurationRedactor $redactor,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('key', InputArgument::OPTIONAL, 'Optional dot-notation configuration key.')
            ->addOption('reveal', null, InputOption::VALUE_NONE, 'Display secrets without redaction.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $key = $input->getArgument('key');
        if ($key !== null && !is_string($key)) {
            throw new \InvalidArgumentException('The configuration key must be a string.');
        }

        $value = $key === null ? $this->configuration->all() : $this->configuration->get($key);
        if (!(bool) $input->getOption('reveal')) {
            if ($key !== null && preg_match('/(?:key|password|secret|token|dsn)$/i', $key) === 1) {
                $value = '[REDACTED]';
            } elseif (is_array($value)) {
                $value = $this->redactor->redact($value);
            }
        }

        if (is_scalar($value) || $value === null) {
            $output->writeln($this->scalar($value));
        } else {
            $output->writeln(json_encode($value, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
        }

        return self::SUCCESS;
    }

    private function scalar(string|int|float|bool|null $value): string
    {
        return match (true) {
            $value === null => 'null',
            $value === true => 'true',
            $value === false => 'false',
            default => (string) $value,
        };
    }
}
