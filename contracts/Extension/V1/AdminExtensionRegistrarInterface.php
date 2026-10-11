<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

interface AdminExtensionRegistrarInterface
{
    public function sidebarItem(string $id, string $label, string $href, int $priority = 50): void;

    /**
     * Register an ES module exporting createPage(host) and optionally createEmbedPicker(host).
     * @param array{group?: string, icon?: string, section?: string, order?: int, hidden?: bool} $navigation Optional sidebar placement, icon, and shop subgroup; hidden pages are left out of the sidebar and opened only by their address (/extension-pages/{plugin}-{id}, /create or /{id}/edit).
     */
    public function page(string $id, string $label, string $module, bool $embeddable = false, array $navigation = []): void;

    /**
     * Add content to a named extension point of an admin screen: a collapsible section, a table or a screen.
     * Points are names such as "page.editor.publishing" or "users.list" (see docs/admin-extension-points.md).
     * Slots: section.start, section.end, section.nested, screen.section, screen.tab,
     * table.column, table.row-action, table.bulk-action, table.toolbar.
     * The ES module exports createPanel (sections and screens), createColumn, createRowAction, createBulkAction
     * or createToolbar, or the function named by options.export.
     * @param array{label?: string, order?: int, icon?: string, default_open?: bool, export?: string} $options
     */
    public function extend(string $point, string $slot, string $id, string $module, array $options = []): void;

    /**
     * Register a React panel shown inside a platform screen. Shorthand for extend(); kept for existing plugins. The ES module exports createPanel(host, info)
     * (or the function named by options.export), and createColumn(host, info) for the pages.list.column location.
     * Locations: page.editor, page.settings, pages.list.column, settings.tab, commerce.product.editor, commerce.category.editor.
     * @param array{order?: int, icon?: string, default_open?: bool, export?: string} $options
     */
    public function panel(string $location, string $id, string $label, string $module, array $options = []): void;

    /** @param 'notice'|'card'|'link' $kind */
    public function slot(string $name, string $kind, string $title, string $text = '', ?string $href = null, int $priority = 50): void;
}
