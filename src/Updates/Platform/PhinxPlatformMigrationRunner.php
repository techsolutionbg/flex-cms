<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Contracts\Updates\PlatformMigrationRunnerInterface;
use Flex\Updates\Exception\PlatformUpdateException;
use Phinx\Console\PhinxApplication;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;

final readonly class PhinxPlatformMigrationRunner implements PlatformMigrationRunnerInterface
{
    public function __construct(
        private string $basePath,
    ) {
    }

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
            throw new PlatformUpdateException(sprintf("Database migrations failed.\n%s", trim($output->fetch())));
        }
    }
}
