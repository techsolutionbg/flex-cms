<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

/**
 * Loads groups of a plugin's public files (frontend.public.groups in plugin.json) only on the pages that need
 * them. Files listed directly under frontend.public stay on every page. Requires the frontend.assets permission.
 */
interface PublicAssetRegistrarInterface
{
    /** Adds the group to the page being rendered, for example from a controller, filter or shortcode. */
    public function enqueue(string $group): void;

    /**
     * Adds the group to every public page for which the condition returns true. The condition runs only when a
     * page's tags are built, so a plugin can register it at boot without work on other requests.
     * @param callable(): bool $condition
     */
    public function enqueueWhen(string $group, callable $condition): void;
}
