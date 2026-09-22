<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Session\CsrfTokenManager;
use Flex\Settings\SettingRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminDashboardController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private ResponseFactoryInterface $responses,
        private CsrfTokenManager $csrf,
        private AdminSidebar $sidebar,
        private SettingRepository $settings,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        // The route middleware guarantees this, but keep the controller defensive.
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->text('Forbidden', 403);
        }

        $csrfToken = htmlspecialchars($this->csrf->token(), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $sidebarWidth = $this->settings->sidebarWidthForUser($user->id);
        $devReloadAttribute = ($_ENV['APP_ENV'] ?? 'production') === 'local' ? ' data-flex-dev-reload="true"' : '';

        return $this->responses->html(<<<HTML
        <!doctype html>
        <html lang="bg">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <meta name="robots" content="noindex,nofollow">
            <link rel="icon" type="image/png" href="/assets/brand/favicon.png">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
            <script src="/assets/vendor/react.production.min.js"></script>
            <script src="/assets/vendor/react-dom.production.min.js"></script>
            <script defer src="/assets/admin.js"></script>
            <title>Административен панел · Flex CMS</title>
            <style>
                :root{--ink:#17211b;--muted:#69736c;--paper:#f4f5ef;--accent:#ff5c35;--line:#dce2dd;--sidebar:#18231d;--sidebar-muted:#aeb9b0;--sidebar-active:#2b3a31}
                *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
                .admin-shell{display:flex;min-height:100vh}.admin-sidebar{display:flex;flex:0 0 248px;flex-direction:column;background:var(--sidebar);color:#fff;padding:24px 14px}.sidebar-brand{display:flex;justify-content:center;padding:0 0 10px;border-bottom:1px solid rgba(255,255,255,.18)}.sidebar-logo{display:block;width:190px;height:auto;padding:0;border-radius:6px;background:#fff}.admin-sidebar nav{display:grid;gap:5px;padding-top:22px}.sidebar-link{display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;color:var(--sidebar-muted);font-weight:650;text-decoration:none}.sidebar-link:hover,.sidebar-link.is-active{background:var(--sidebar-active);color:#fff}.sidebar-link.is-active{box-shadow:inset 3px 0 var(--accent)}.sidebar-icon{width:22px;text-align:center;font-size:1.05rem}.sidebar-footer{display:flex;align-items:flex-end;justify-content:flex-end;gap:6px;margin-top:auto;padding:18px 12px 4px;color:var(--sidebar-muted);font-size:.78rem;text-align:right}.sidebar-footer strong{color:#fff;font-weight:650}
                .admin-main{min-width:0;flex:1}header{display:flex;align-items:center;justify-content:space-between;padding:22px max(24px,calc((100% - 1120px)/2));background:#fff;border-bottom:1px solid var(--line)}
                .brand{color:var(--accent);font-size:.78rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
                .user{color:var(--muted);font-size:.9rem}.layout{width:min(1120px,calc(100% - 48px));margin:48px auto}
                h1{margin:0 0 8px;font:500 clamp(2.2rem,5vw,4.5rem)/1 Georgia,serif;letter-spacing:-.04em}p{color:var(--muted)}
                .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:32px}
                .card{padding:24px;background:#fff;border:1px solid var(--line);border-radius:16px}.card h2{margin:0 0 8px;font-size:1.15rem}.card a{color:var(--ink);font-weight:700}
                form{display:inline}.logout{border:0;background:transparent;color:var(--muted);font:inherit;cursor:pointer;text-decoration:underline}@media(max-width:720px){.admin-sidebar{flex-basis:72px;padding:18px 8px}.sidebar-brand{padding:4px 0 22px;text-align:center}.sidebar-logo{width:190px}.sidebar-link>span{display:none}.sidebar-link{justify-content:center}.sidebar-icon{width:auto}.sidebar-footer{display:block;padding:18px 0 4px;font-size:.68rem}.sidebar-footer span{display:none}.layout{width:min(100% - 32px,1120px);margin:32px auto}}.admin-sidebar{position:fixed;inset:0 auto 0 0;width:248px;height:100vh;z-index:10}.admin-main{margin-left:248px}.sidebar-brand{width:calc(100% + 28px);margin-left:-14px;margin-right:-14px;padding-left:26px;padding-right:26px}.sidebar-footer{position:absolute;right:14px;bottom:18px;margin:0}@media(max-width:720px){.admin-sidebar{width:72px}.admin-main{margin-left:72px}.sidebar-brand{width:calc(100% + 16px);margin-left:-8px;margin-right:-8px;padding-left:8px;padding-right:8px}.sidebar-logo{width:180px}}
            </style>
            <link rel="stylesheet" href="/assets/admin.css">
        </head>
        <body{$devReloadAttribute} style="--sidebar-width:{$sidebarWidth}px"><div id="flex-admin-app" class="admin-shell">{$this->sidebar->render('dashboard', $sidebarWidth)}<div class="admin-main">
            <header style="min-height:66px;height:66px;padding:0 var(--admin-content-gutter);align-items:center"><div class="topbar-spacer" aria-hidden="true"></div><div class="topbar-actions"><form method="post" action="/logout"><input type="hidden" name="_token" value="{$csrfToken}"><button class="logout" type="submit">Изход</button></form></div></header>
            <main class="layout">
                <h1>Административен панел</h1>
                <p>Имате пълен достъп до системната администрация като супер администратор.</p>
                <section class="grid" aria-label="Административни секции">
                    <noscript><article class="card"><h2>Потребители</h2><p>Управление на потребители, роли и статуси.</p><a href="/api/users">Отвори API →</a></article><article class="card"><h2>Обновявания</h2><p>Проверка, инсталация и rollback на подписани platform пакети.</p><a href="/admin/updates">Отвори обновявания →</a></article></noscript>
                </section>
            </main></div></div></body>
        </html>
        HTML);
    }
}
