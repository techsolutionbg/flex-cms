<?php

declare(strict_types=1);

namespace Flex\Tests\Installer;

use Flex\Installer\Exception\InstallerException;
use Flex\Installer\InstallerInput;
use PHPUnit\Framework\TestCase;

final class InstallerInputTest extends TestCase
{
    public function testItNormalizesAndValidatesInstallerValues(): void
    {
        $input = InstallerInput::fromArray($this->validValues());

        self::assertSame('Flex CMS', $input->siteName);
        self::assertSame('https://example.com', $input->siteUrl);
        self::assertSame('admin@example.com', $input->adminEmail);
        self::assertSame(3306, $input->databasePort);
    }

    public function testItAllowsHttpForLocalXamppDevelopment(): void
    {
        $values = $this->validValues();
        $values['site_url'] = 'http://localhost/flex-cms';

        $input = InstallerInput::fromArray($values);

        self::assertSame('http://localhost/flex-cms', $input->siteUrl);
    }

    public function testItRejectsInvalidAndWeakValues(): void
    {
        $values = $this->validValues();
        $values['site_url'] = 'javascript:alert(1)';
        $values['database_port'] = '70000';
        $values['database_name'] = 'invalid database';
        $values['admin_email'] = 'invalid';
        $values['admin_password'] = 'short';

        $this->expectException(InstallerException::class);
        $this->expectExceptionMessage('Site URL must use HTTPS, except for local HTTP development hosts.');

        InstallerInput::fromArray($values);
    }

    /** @return array<string, string> */
    private function validValues(): array
    {
        return [
            'site_name' => ' Flex CMS ',
            'site_url' => 'https://example.com/',
            'timezone' => 'Europe/Sofia',
            'locale' => 'bg',
            'database_host' => 'localhost',
            'database_port' => '3306',
            'database_name' => 'flex_cms',
            'database_username' => 'flex_cms',
            'database_password' => 'database-secret',
            'admin_name' => 'Administrator',
            'admin_email' => 'ADMIN@example.com',
            'admin_password' => 'a-secure-password',
        ];
    }
}
