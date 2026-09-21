<?php

declare(strict_types=1);

namespace Flex\Tests\Installer;

use Flex\Installer\Http\InstallerRenderer;
use Flex\Installer\Requirement;
use Flex\Installer\RequirementsReport;
use PHPUnit\Framework\TestCase;

final class InstallerRendererTest extends TestCase
{
    public function testItEscapesValuesAndNeverRendersSubmittedPasswords(): void
    {
        $html = (new InstallerRenderer())->form(
            new RequirementsReport([new Requirement('PHP', true, '8.3')]),
            'csrf-token',
            [
                'site_name' => '<script>alert(1)</script>',
                'database_password' => 'database-secret',
                'admin_password' => 'admin-secret',
            ],
        );

        self::assertStringContainsString('&lt;script&gt;alert(1)&lt;/script&gt;', $html);
        self::assertStringNotContainsString('database-secret', $html);
        self::assertStringNotContainsString('admin-secret', $html);
        self::assertStringContainsString('name="csrf_token"', $html);
    }
}
