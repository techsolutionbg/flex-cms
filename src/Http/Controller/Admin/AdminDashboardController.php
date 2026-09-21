<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Session\CsrfTokenManager;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminDashboardController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private ResponseFactoryInterface $responses,
        private CsrfTokenManager $csrf,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        // The route middleware guarantees this, but keep the controller defensive.
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->text('Forbidden', 403);
        }

        $name = htmlspecialchars($user->name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $csrfToken = htmlspecialchars($this->csrf->token(), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        return $this->responses->html(<<<HTML
        <!doctype html>
        <html lang="bg">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <meta name="robots" content="noindex,nofollow">
            <title>Административен панел · Flex CMS</title>
            <style>
                :root{--ink:#17211b;--muted:#69736c;--paper:#f4f5ef;--accent:#ff5c35;--line:#dce2dd}
                *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
                header{display:flex;align-items:center;justify-content:space-between;padding:22px max(24px,calc((100% - 1120px)/2));background:#fff;border-bottom:1px solid var(--line)}
                .brand{color:var(--accent);font-size:.78rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
                .user{color:var(--muted);font-size:.9rem}.layout{width:min(1120px,calc(100% - 48px));margin:48px auto}
                h1{margin:0 0 8px;font:500 clamp(2.2rem,5vw,4.5rem)/1 Georgia,serif;letter-spacing:-.04em}p{color:var(--muted)}
                .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:32px}
                .card{padding:24px;background:#fff;border:1px solid var(--line);border-radius:16px}.card h2{margin:0 0 8px;font-size:1.15rem}.card a{color:var(--ink);font-weight:700}
                form{display:inline}.logout{border:0;background:transparent;color:var(--muted);font:inherit;cursor:pointer;text-decoration:underline}
            </style>
        </head>
        <body>
            <header><div class="brand">Flex CMS · Admin</div><div class="user">{$name} · <form method="post" action="/logout"><input type="hidden" name="_token" value="{$csrfToken}"><button class="logout" type="submit">Изход</button></form></div></header>
            <main class="layout">
                <h1>Административен панел</h1>
                <p>Имате пълен достъп до системната администрация като супер администратор.</p>
                <section class="grid" aria-label="Административни секции">
                    <article class="card"><h2>Потребители</h2><p>Управление на потребители, роли и статуси.</p><a href="/api/users">Отвори API →</a></article>
                    <article class="card"><h2>Системен достъп</h2><p>Тази секция е достъпна единствено за ролята <code>super_admin</code>.</p></article>
                </section>
            </main>
        </body>
        </html>
        HTML);
    }
}
