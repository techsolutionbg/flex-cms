<?php
declare(strict_types=1);
namespace Flex\Tests\Settings;

use Flex\Configuration\ConfigurationRepository;
use Flex\Database\DatabaseManager;
use Flex\Settings\GeneralSettings;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;

final class GeneralSettingsTest extends TestCase
{
    public function testDefaultsPersistenceValidationAndTimezoneFormatting(): void
    {
        $configuration = new ConfigurationRepository(['app' => ['name' => 'Default', 'timezone' => 'UTC'], 'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]]]);
        $database = new DatabaseManager($configuration);
        $database->schema()->create('settings', static function (Blueprint $table): void {
            $table->string('key')->primary(); $table->text('value'); $table->string('type'); $table->string('group'); $table->boolean('autoload'); $table->timestamps();
        });
        try {
            $service = new GeneralSettings($database, $configuration);
            self::assertSame('Default', $service->all()['name']);
            $values = $service->all();
            $values['name'] = ' My Site '; $values['timezone'] = 'Europe/Sofia';
            $values['description'] = 'Описание';
            $saved = $service->save($values);
            self::assertSame('My Site', $saved['name']);
            self::assertSame($saved, (new GeneralSettings($database, $configuration))->all());
            self::assertSame(6, $database->connection()->table('settings')->count());
            self::assertSame('06.10.2026 15:00', $service->formatDate(new \DateTimeImmutable('2026-10-06T12:00:00Z')));
            foreach (['name' => '', 'description' => str_repeat('a', 501), 'locale' => 'invalid', 'timezone' => 'Invalid/Zone', 'date_format' => 'bad', 'time_format' => 'bad'] as $key => $value) {
                try { $service->save(array_replace($saved, [$key => $value])); self::fail('Invalid settings accepted'); }
                catch (\InvalidArgumentException $error) { self::assertSame(422, $error->getCode()); }
                self::assertSame($saved, $service->all());
            }
            $guest = $this->createStub(\Flex\Contracts\Auth\AuthenticationInterface::class);
            $guest->method('user')->willReturn(null);
            $controller = new \Flex\Http\Controller\Admin\AdminGeneralSettingsController($guest, $service, new \Flex\Http\ResponseFactory(new \Nyholm\Psr7\Factory\Psr17Factory()), new \Flex\Http\RequestInput());
            self::assertSame(403, $controller(new \Nyholm\Psr7\ServerRequest('PUT', 'http://localhost/api/admin/settings/general'))->getStatusCode());
            self::assertSame($saved, $service->all());
        } finally { $database->disconnect(); }
    }
}
