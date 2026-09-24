<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

final class EventNames
{
    public const PLUGIN_INSTALLED = 'plugin.installed';
    public const PLUGIN_ACTIVATED = 'plugin.activated';
    public const PLUGIN_DEACTIVATED = 'plugin.deactivated';
    public const PLUGIN_UPDATED = 'plugin.updated';
    public const PLUGIN_UNINSTALLED = 'plugin.uninstalled';
    public const PAGE_CREATED = 'page.created';
    public const PAGE_UPDATED = 'page.updated';
    public const PAGE_TRASHED = 'page.trashed';
    public const PAGE_RESTORED = 'page.restored';
    public const PAGE_DELETED = 'page.deleted';

    private function __construct() {}
}
