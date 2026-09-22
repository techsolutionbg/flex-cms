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
            <link rel="stylesheet" href="/build/admin/admin.css">
            <script defer src="/assets/admin.js"></script>
            <title>Административен панел · Flex CMS</title>
            <style>
                *{box-sizing:border-box}body{background:var(--background);color:var(--foreground)}
                header{display:flex;align-items:center;justify-content:space-between}.brand{font-size:.78rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
                .user{font-size:.9rem}.layout{width:min(1120px,calc(100% - 48px));margin:48px auto}
                h1{margin:0 0 8px;font:500 clamp(2.2rem,5vw,4.5rem)/1 var(--font-family-heading);letter-spacing:-.04em}p{color:var(--muted-foreground)}
                .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:32px}
                .card{padding:24px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-xl);box-shadow:var(--shadow-sm)}.card h2{margin:0 0 8px;font-size:1.15rem}.card a{color:var(--foreground);font-weight:700}
                form{display:inline}.logout{border:0;background:transparent;font:inherit;cursor:pointer;text-decoration:underline}@media(max-width:45rem){.layout{width:min(100% - 32px,1120px);margin:32px auto}}
            </style>
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
