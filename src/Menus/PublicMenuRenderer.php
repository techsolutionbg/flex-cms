<?php

declare(strict_types=1);

namespace Flex\Menus;

use Flex\Database\DatabaseManager;
use Flex\Pages\PublicPageSet;

/** Theme-independent, escaped menu markup and structured data for PHP and Twig themes. */
final readonly class PublicMenuRenderer
{
    public function __construct(private DatabaseManager $database) {}

    /** @param array<string, string> $locations
     * @return array<string, mixed>
     */
    public function forTheme(string $theme, PublicPageSet $pages, array $locations): array
    {
        $menus = [];
        $html = [];
        if ($locations === []) {
            return ['menus' => [], 'menu_html' => []];
        }
        $db = $this->database->connection();
        $bindings = $db->table('theme_menu_assignments')->join('menus', 'menus.id', '=', 'theme_menu_assignments.menu_id')->whereNull('menus.deleted_at')->where('menus.status', 'active')->where('theme_id', $theme)->pluck('menu_id', 'location');
        foreach ($locations as $location => $label) {
            if (!isset($bindings[$location])) {
                continue;
            }
            $menus[$location] = $this->itemsForMenu((int) $bindings[$location], $pages);
            $html[$location] = $this->renderItems($menus[$location]);
        }
        return ['menus' => $menus, 'menu_html' => $html];
    }

    /** Return one active, non-deleted menu and its safe public tree by slug. */
    public function bySlug(string $slug, PublicPageSet $pages): array
    {
        $slug = trim($slug);
        if ($slug === '') {
            return [];
        }
        $menu = $this->database->connection()->table('menus')
            ->where('slug', $slug)
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->first();
        if ($menu === null) {
            return [];
        }

        return [
            'id' => (int) $menu->id,
            'name' => (string) $menu->name,
            'slug' => (string) $menu->slug,
            'items' => $this->itemsForMenu((int) $menu->id, $pages),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function itemsForMenu(int $menuId, PublicPageSet $pages): array
    {
        $rows = $this->database->connection()->table('menu_items')->where('menu_id', $menuId)->orderBy('position')->get()->all();
        $build = function (?string $parent, int $depth = 1) use (&$build, $rows, $pages): array {
            if ($depth > 3) {
                return [];
            }
            $items = [];
            foreach ($rows as $row) {
                if ($row->parent_key !== $parent) {
                    continue;
                }
                $page = $row->type === 'page' ? $pages->findPublishedById((int) $row->page_id) : null;
                if ($row->type === 'page' && $page === null) {
                    continue;
                }
                $url = $page && !$row->url ? '/' . ltrim($pages->publicPath($page), '/') : (string) $row->url;
                if (!MenuService::safeUrl($url)) {
                    continue;
                }
                $items[] = ['id' => $row->item_key, 'label' => $row->label, 'url' => $url, 'new_tab' => (bool) $row->new_tab, 'seo_title' => $row->seo_title, 'aria_label' => $row->aria_label, 'css_class' => $row->css_class, 'rel' => $row->rel, 'children' => $build($row->item_key, $depth + 1)];
            }
            return $items;
        };

        return $build(null);
    }

    /** @param list<array<string, mixed>> $items */
    public function renderItems(array $items): string
    {
        if ($items === []) {
            return '';
        }
        $html = '<ul class="theme-menu">';
        foreach ($items as $item) {
            $escape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $attributes = '';
            foreach (['seo_title' => 'title', 'aria_label' => 'aria-label', 'css_class' => 'class'] as $field => $attribute) {
                if ($item[$field] !== '') {
                    $attributes .= ' ' . $attribute . '="' . $escape($item[$field]) . '"';
                }
            }
            $rel = $item['rel'] === '' ? [] : explode(' ', $item['rel']);
            if ($item['new_tab']) {
                $attributes .= ' target="_blank"';
                $rel = array_unique([...$rel, 'noopener', 'noreferrer']);
            }
            if ($rel !== []) {
                $attributes .= ' rel="' . $escape(implode(' ', $rel)) . '"';
            }
            $html .= '<li><a href="' . $escape($item['url']) . '"' . $attributes . '>' . $escape($item['label']) . '</a>';
            if ($item['children'] !== []) {
                $html .= '<details class="theme-submenu"><summary aria-label="' . $escape('Подменю: ' . $item['label']) . '">▾</summary>' . $this->renderItems($item['children']) . '</details>';
            }
            $html .= '</li>';
        }
        return $html . '</ul>';
    }
}
