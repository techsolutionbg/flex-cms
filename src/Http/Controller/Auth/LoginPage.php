<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Auth;

final class LoginPage
{
    public function render(string $csrfToken, ?string $error = null): string
    {
        $token = $this->escape($csrfToken);
        $errorMarkup = $error === null ? '' : '<div class="error" role="alert">' . $this->escape($error) . '</div>';

        return <<<HTML
        <!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Вход · Flex CMS</title><style>:root{--ink:#17211b;--muted:#69736c;--paper:#f4f5ef;--accent:#ff5c35}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 15% 10%,#fff,transparent 35%),var(--paper);color:var(--ink);font:16px/1.5 system-ui,sans-serif}.card{width:min(430px,calc(100% - 32px));padding:38px;background:#fff;border:1px solid #dce2dd;border-radius:20px;box-shadow:0 24px 70px rgba(23,33,27,.09)}.brand{color:var(--accent);font-size:.78rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase}h1{margin:10px 0 8px;font:500 2.5rem/1 Georgia,serif;letter-spacing:-.03em}p{margin:0 0 28px;color:var(--muted)}label{display:block;margin:16px 0 0;font-size:.82rem;font-weight:750;text-transform:uppercase;letter-spacing:.04em}input{width:100%;margin-top:7px;padding:13px 14px;border:1px solid #cbd3cd;border-radius:9px;font:inherit;outline:none}input:focus{border-color:#2d6cdf;box-shadow:0 0 0 3px rgba(45,108,223,.12)}button{width:100%;margin-top:24px;padding:14px;border:0;border-radius:9px;background:var(--ink);color:#fff;font:700 1rem system-ui;cursor:pointer}.error{margin:20px 0 -2px;padding:12px;border:1px solid #f2b8b5;border-radius:8px;background:#fff1f0;color:#b42318}</style></head><body><main class="card"><div class="brand">Flex CMS</div><h1>Добре дошли.</h1><p>Влезте, за да управлявате сайта.</p>{$errorMarkup}<form method="post" action="/login"><input type="hidden" name="_token" value="{$token}"><label>Имейл<input type="email" name="email" autocomplete="username" required autofocus></label><label>Парола<input type="password" name="password" autocomplete="current-password" required></label><button type="submit">Вход →</button></form></main></body></html>
        HTML;
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
