<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Configuration\EnvironmentValidator;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'config:validate', description: 'Validate the resolved Flex CMS configuration.')]
final class ConfigValidateCommand extends Command
{
    public function __construct(
        private readonly ConfigRepositoryInterface $configuration,
        private readonly EnvironmentValidator $validator,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $this->validator->validate($this->configuration);
        (new SymfonyStyle($input, $output))->success('The Flex CMS configuration is valid.');

        return self::SUCCESS;
    }
}
