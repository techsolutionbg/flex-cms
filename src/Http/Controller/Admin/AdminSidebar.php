<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Updates\Platform\PlatformVersionRegistry;

final class AdminSidebar
{
    public function __construct(
        private readonly PlatformVersionRegistry $versions,
    ) {}

    public function render(string $active, int $width = 248): string
    {
        $dashboard = $active === 'dashboard' ? ' aria-current="page"' : '';
        $updates = $active === 'updates' ? ' aria-current="page"' : '';
        $version = htmlspecialchars($this->versions->current()->value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $width = max(180, min(420, $width));

        return <<<HTML
        <button class="sidebar-toggle" type="button" aria-controls="admin-sidebar" aria-label="Прибери страничната лента" aria-expanded="true" title="Прибери страничната лента"><svg class="sidebar-toggle-icon" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg></button>
        <aside id="admin-sidebar" class="admin-sidebar" data-sidebar-width="{$width}">
            <div class="sidebar-resizer" role="separator" tabindex="0" aria-label="Промени широчината на страничната лента" aria-orientation="vertical" aria-valuemin="180" aria-valuemax="420" aria-valuenow="{$width}" title="Плъзнете или използвайте стрелките за промяна на широчината"></div>
            <div class="sidebar-brand"><img class="sidebar-logo" src="/assets/brand/logo.png" alt="Flex CMS"></div>
            <nav aria-label="Административна навигация">
                <a class="sidebar-link{$this->activeClass($active, 'dashboard')}" href="/admin"{$dashboard}><svg class="sidebar-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13a9 9 0 1 1 18 0"/><path d="m12 13 4-4"/><path d="M5 20h14"/></svg><span>Табло</span></a>
                <a class="sidebar-link{$this->activeClass($active, 'updates')}" href="/admin/updates"{$updates}><svg class="sidebar-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-7V0"/><path d="M20 7a9 9 0 1 0 2 9"/></svg><span>Обновявания</span></a>
            </nav>
            <div class="sidebar-footer"><span>Flex CMS</span><strong>v{$version}</strong></div>
        </aside>
        <button class="sidebar-backdrop" type="button" aria-label="Затвори страничната лента" hidden></button>
        HTML;
    }

    private function activeClass(string $active, string $item): string
    {
        return $active === $item ? ' is-active' : '';
    }
}
