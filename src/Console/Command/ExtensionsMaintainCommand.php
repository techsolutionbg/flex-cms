<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Extension\V1\ExtensionApiInterface;
use Flex\Extensions\PluginRuntime;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'extensions:maintain', description: 'Run maintenance callbacks of active plugins (outbox delivery, retention).')]
final class ExtensionsMaintainCommand extends Command
{
    public function __construct(private readonly PluginRuntime $runtime, private readonly ExtensionApiInterface $api)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $this->runtime->bootActive();
        $this->api->doAction('extensions.maintenance');
        $output->writeln('Active extension maintenance completed.');
        return self::SUCCESS;
    }
}
