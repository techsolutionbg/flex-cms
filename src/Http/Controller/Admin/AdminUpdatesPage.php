<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Settings\SettingRepository;

final class AdminUpdatesPage
{
    public function __construct(
        private readonly AdminSidebar $sidebar,
        private readonly AuthenticationInterface $authentication,
        private readonly SettingRepository $settings,
    ) {}

    /** @param list<array<string, mixed>> $history
     *  @param array<string, mixed>|null $inspection
     */
    public function render(string $csrfToken, array $history, ?string $notice = null, ?string $error = null, ?array $inspection = null): string
    {
        $token = $this->escape($csrfToken);
        $user = $this->authentication->user();
        $sidebarWidth = $user instanceof AuthenticatedUser ? $this->settings->sidebarWidthForUser($user->id) : 248;
        $devReloadAttribute = ($_ENV['APP_ENV'] ?? 'production') === 'local' ? ' data-flex-dev-reload="true"' : '';
        $noticeMarkup = $notice === null ? '' : '<div class="notice success">' . $this->escape($notice) . '</div>';
        $errorMarkup = $error === null ? '' : '<div class="notice error">' . $this->escape($error) . '</div>';
        $inspectionMarkup = '';
        if ($inspection !== null) {
            $inspectionMarkup = sprintf(
                '<div class="notice info"><strong>Пакетът е валиден.</strong><br>Версия: %s · Файлове: %s · Миграции: %s</div>',
                $this->escape((string) ($inspection['version'] ?? '-')),
                $this->escape((string) ($inspection['files'] ?? '-')),
                ($inspection['migrations'] ?? false) ? 'да' : 'не',
            );
        }

        $historyJson = json_encode(array_reverse($history), JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
        $historyAttribute = $this->escape($historyJson);

        $html = <<<HTML
        <!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><link rel="icon" type="image/png" href="/assets/brand/favicon.png"><title>Обновявания · Flex CMS</title>
        <link rel="stylesheet" href="/build/admin/admin.css"><style>*{box-sizing:border-box}body{background:var(--background);color:var(--foreground)}header{display:flex;justify-content:space-between;align-items:center}.brand{font-size:.78rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase}.user{font-size:.9rem}.user form{display:inline}.logout{border:0;background:transparent;font:inherit;cursor:pointer;text-decoration:underline}main{width:min(1120px,calc(100% - 48px));margin:44px auto}h1{margin:0 0 8px;font:500 clamp(2.4rem,5vw,4.5rem)/1 var(--font-family-heading);letter-spacing:-.04em}h2{margin-top:0;font-size:1.25rem}.lead,.muted{color:var(--muted-foreground)}.card{margin-top:28px;padding:26px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-xl);box-shadow:var(--shadow-sm)}.notice{margin:18px 0;padding:14px 16px;border-radius:var(--radius)}.success{background:color-mix(in oklch,var(--success) 12%,var(--card));color:var(--success)}.error{background:color-mix(in oklch,var(--destructive) 12%,var(--card));color:var(--destructive)}.info{background:color-mix(in oklch,var(--info) 12%,var(--card));color:var(--info)}label{display:block;margin:15px 0 6px;font-weight:700}input[type=file],input[type=text]{width:100%;padding:12px;border:1px solid var(--input);border-radius:var(--radius-md);background:var(--background);color:var(--foreground);font:inherit}button{margin-top:18px;padding:12px 18px;border:0;border-radius:var(--radius-md);background:var(--primary);color:var(--primary-foreground);font:700 1rem var(--font-family-sans);cursor:pointer}.small{margin:0;padding:7px 10px;font-size:.82rem}.danger{background:var(--destructive);color:white}table{width:100%;border-collapse:collapse}th,td{padding:12px 10px;text-align:left;border-bottom:1px solid var(--border);vertical-align:middle}th{font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}@media(max-width:45rem){main{width:min(100% - 32px,1120px);margin:32px auto}}</style><script defer src="/assets/admin.js"></script></head><body{$devReloadAttribute} style="--sidebar-width:{$sidebarWidth}px"><div class="admin-shell">{$this->sidebar->render('updates', $sidebarWidth)}<div class="admin-main">
        <header><div class="topbar-spacer" aria-hidden="true"></div><div class="topbar-actions"><form method="post" action="/logout"><input type="hidden" name="_token" value="{$token}"><button class="logout" type="submit">Изход</button></form></div></header><main class="layout"><h1>Обновявания</h1><p class="lead">Качете ZIP пакет за версията и стартирайте контролирано обновяване с един бутон.</p>{$noticeMarkup}{$errorMarkup}{$inspectionMarkup}
        <section class="card"><h2>Качване на platform пакет</h2><form method="post" action="/admin/updates/install" enctype="multipart/form-data"><input type="hidden" name="_token" value="{$token}"><input type="hidden" name="mode" value="install"><label for="package">ZIP пакет на новата версия</label><input id="package" type="file" name="package" accept="application/zip,.zip" required><button type="submit">Актуализирай платформата</button></form><p class="muted">След качването системата автоматично изчислява checksum, проверява цифровия подпис и съвместимостта, прави backup, активира maintenance mode, изпълнява миграциите и прави health check. Не качвайте private signing key.</p></section>
        <section class="card"><h2>История</h2><div id="flex-shadcn-history-root" data-history="{$historyAttribute}" data-csrf="{$token}"></div></section></main></div></div></body></html>
        HTML;

        return $html;
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
