<?php

declare(strict_types=1);

namespace Flex\Installer;

use Flex\Installer\Contracts\MigrationRunnerInterface;
use Flex\Installer\Exception\InstallerException;
use Phinx\Console\PhinxApplication;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;

final readonly class InstallerMigrationRunner implements MigrationRunnerInterface
{
    public function __construct(
        private string $basePath,
    ) {}

    public function migrate(): void
    {
        $application = new PhinxApplication();
        $application->setAutoExit(false);
        $output = new BufferedOutput();
        $exitCode = $application->run(new ArrayInput([
            'command' => 'migrate',
            '--configuration' => $this->basePath . '/phinx.php',
            '--environment' => 'default',
            '--no-interaction' => true,
        ]), $output);

        if ($exitCode !== 0) {
            throw new InstallerException(sprintf('Database migrations failed: %s', trim($output->fetch())));
        }
    }
}
