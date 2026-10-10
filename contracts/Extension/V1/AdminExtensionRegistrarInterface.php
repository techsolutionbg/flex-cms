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

    /**
     * Register a React panel shown inside a platform screen. The ES module exports createPanel(host, info)
     * (or the function named by options.export), and createColumn(host, info) for the pages.list.column location.
     * Locations: page.editor, page.settings, pages.list.column, settings.tab, commerce.product.editor, commerce.category.editor.
     * @param array{order?: int, icon?: string, default_open?: bool, export?: string} $options
     */
    public function panel(string $location, string $id, string $label, string $module, array $options = []): void;

    /** @param 'notice'|'card'|'link' $kind */
    public function slot(string $name, string $kind, string $title, string $text = '', ?string $href = null, int $priority = 50): void;
}
