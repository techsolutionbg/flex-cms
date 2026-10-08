<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

interface AdminExtensionRegistrarInterface
{
    public function sidebarItem(string $id, string $label, string $href, int $priority = 50): void;

    /**
     * Register an ES module exporting createPage(host) and optionally createEmbedPicker(host).
     * @param array{group?: string, icon?: string, section?: string, order?: int} $navigation Optional sidebar placement, icon, and shop subgroup.
     */
    public function page(string $id, string $label, string $module, bool $embeddable = false, array $navigation = []): void;

    /** @param 'notice'|'card'|'link' $kind */
    public function slot(string $name, string $kind, string $title, string $text = '', ?string $href = null, int $priority = 50): void;
}
