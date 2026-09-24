<?php

declare(strict_types=1);

namespace Flex\Tests\Extensions;

use Flex\Extensions\ExtensionApi;
use Flex\Extension\V1\EventNames;
use Flex\Extension\V1\PageEvent;
use PHPUnit\Framework\TestCase;

final class ExtensionApiTest extends TestCase
{
    public function testFiltersRunByPriorityAndActionsReceiveContext(): void
    {
        $api = new ExtensionApi();
        $actions = [];
        $api->addFilter('page.title', static fn(mixed $value, array $context): string => $value . ' [' . $context['locale'] . ']', 20);
        $api->addFilter('page.title', static fn(mixed $value, array $context): string => strtoupper((string) $value), 10);
        $api->addAction('page.saved', static function (array $context) use (&$actions): void {
            $actions[] = $context['id'];
        });

        self::assertSame('HOME [bg]', $api->applyFilters('page.title', 'Home', ['locale' => 'bg']));
        $api->doAction('page.saved', ['id' => 42]);
        self::assertSame([42], $actions);
    }

    public function testEventsRunByPriorityWithTypedPublicPayload(): void
    {
        $api = new ExtensionApi();
        $received = [];
        $api->listen(EventNames::PAGE_CREATED, static function (PageEvent $event) use (&$received): void {
            $received[] = $event->payload()['page']['id'];
        }, 20);

        $api->dispatch(new PageEvent(EventNames::PAGE_CREATED, ['id' => 7, 'title' => 'Home']));

        self::assertSame([7], $received);
    }
}
