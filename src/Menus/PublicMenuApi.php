<?php

declare(strict_types=1);

namespace Flex\Menus;

use Flex\Pages\PublicPageSet;

/** Theme-facing menu lookup API. */
final readonly class PublicMenuApi
{
    public function __construct(private PublicMenuRenderer $renderer, private PublicPageSet $pages) {}

    /** @return array{id: int, name: string, slug: string, items: list<array<string, mixed>>}|array{} */
    public function get(string $slug): array
    {
        return $this->renderer->bySlug($slug, $this->pages);
    }

    /** Return escaped HTML for a menu, or an empty string if it is unavailable. */
    public function html(string $slug): string
    {
        $menu = $this->get($slug);

        return $menu === [] ? '' : $this->renderer->renderItems($menu['items']);
    }
}
