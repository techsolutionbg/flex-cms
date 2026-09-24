<?php

declare(strict_types=1);

namespace Flex\Extensions;

final class PluginPermissions
{
    public const FRONTEND_ASSETS = 'frontend.assets';
    public const ROUTES_PUBLIC = 'routes.public';
    public const ROUTES_ADMIN = 'routes.admin';
    public const CONTENT_BLOCKS = 'content.blocks';
    public const EVENTS_LISTEN = 'events.listen';
    public const ADMIN_UI = 'admin.ui';

    /** @param list<string> $permissions */
    public static function allows(array $permissions, string $permission): bool
    {
        return in_array($permission, $permissions, true);
    }

    /**
     * @param list<string> $requested
     * @param list<string> $approved
     * @return list<string>
     */
    public static function missing(array $requested, array $approved): array
    {
        return array_values(array_diff($requested, $approved));
    }

    private function __construct() {}
}
