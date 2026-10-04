<?php

declare(strict_types=1);

namespace Flex\Installer;

use Flex\Installer\Contracts\AdministratorCreatorInterface;
use Flex\Installer\Contracts\DatabaseProbeInterface;
use Flex\Installer\Contracts\EnvironmentWriterInterface;
use Flex\Installer\Contracts\MigrationRunnerInterface;
use Flex\Installer\Exception\InstallerException;
use Flex\Updates\Platform\PlatformVersionRegistry;

final readonly class WebInstaller
{
    public function __construct(
        private string $basePath,
        private InstallationState $state,
        private RequirementsChecker $requirements,
        private DatabaseProbeInterface $database,
        private EnvironmentWriterInterface $environment,
        private MigrationRunnerInterface $migrations,
        private AdministratorCreatorInterface $administrator,
        private PlatformVersionRegistry $versions,
    ) {}

    public function install(InstallerInput $input): void
    {
        if (!$this->state->requiresInstallation()) {
            throw new InstallerException('Flex CMS is already installed.');
        }
        if (!$this->requirements->check()->passed()) {
            throw new InstallerException('The server does not satisfy all Flex CMS requirements.');
        }

        $lockPath = $this->basePath . '/storage/tmp/installer.lock';
        $lock = @fopen($lockPath, 'c+');
        if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
            if (is_resource($lock)) {
                fclose($lock);
            }
            throw new InstallerException('Another installation process is already running.');
        }

        try {
            $this->performInstallation($input);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function performInstallation(InstallerInput $input): void
    {
        $probe = $this->database->check($input);
        if (!$probe->connected) {
            throw new InstallerException($probe->error ?? 'The database connection failed.');
        }

        $values = $this->environmentValues($input);
        $this->environment->write($values);
        foreach ($values as $key => $value) {
            $_ENV[$key] = $value;
        }

        try {
            $this->migrations->migrate();
            $this->administrator->create($input);
            $this->writeMarker($input);
        } catch (\Throwable $exception) {
            $this->environment->remove();
            throw new InstallerException('Flex CMS installation failed. You can correct the settings and try again.', 0, $exception);
        }
    }

    /** @return array<string, string> */
    private function environmentValues(InstallerInput $input): array
    {
        return [
            'APP_NAME' => $input->siteName,
            'APP_ENV' => str_starts_with($input->siteUrl, 'http://') ? 'local' : 'production',
            'APP_DEBUG' => 'false',
            'APP_URL' => $input->siteUrl,
            'APP_KEY' => bin2hex(random_bytes(32)),
            'APP_TIMEZONE' => $input->timezone,
            'APP_LOCALE' => $input->locale,
            'APP_FALLBACK_LOCALE' => 'en',
            'APP_MAINTENANCE' => 'false',
            'APP_CONFIG_CACHE' => 'false',
            'APP_CONTAINER_COMPILE' => 'false',
            'DB_CONNECTION' => 'mysql',
            'DB_HOST' => $input->databaseHost,
            'DB_PORT' => (string) $input->databasePort,
            'DB_DATABASE' => $input->databaseName,
            'DB_USERNAME' => $input->databaseUsername,
            'DB_PASSWORD' => $input->databasePassword,
            'FORCE_HTTPS' => str_starts_with($input->siteUrl, 'https://') ? 'true' : 'false',
        ];
    }

    private function writeMarker(InstallerInput $input): void
    {
        $payload = json_encode([
            'installed_at' => gmdate(DATE_ATOM),
            'platform_version' => $this->versions->current()->value,
            'site_url' => $input->siteUrl,
        ], JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        $path = $this->state->markerPath();
        $temporary = $path . '.tmp';

        if (file_put_contents($temporary, $payload . PHP_EOL, LOCK_EX) === false || !@rename($temporary, $path)) {
            @unlink($temporary);
            throw new InstallerException('The installation marker could not be written.');
        }
    }
}
