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

        $rows = '';
        foreach (array_reverse($history) as $record) {
            $type = (string) ($record['type'] ?? 'unknown');
            $id = (string) ($record['id'] ?? '-');
            $from = (string) ($record['from'] ?? '-');
            $to = (string) ($record['to'] ?? '-');
            $date = (string) ($record['installed_at'] ?? $record['rolled_back_at'] ?? '-');
            $rollback = $type === 'platform' && ($record['migrations_ran'] ?? false) !== true
                ? '<form method="post" action="/admin/updates/rollback"><input type="hidden" name="_token" value="' . $token . '"><input type="hidden" name="id" value="' . $this->escape($id) . '"><input type="hidden" name="confirm" value="1"><button class="small danger" type="submit">Rollback</button></form>'
                : '<span class="muted">—</span>';
            $rows .= '<tr><td>' . $this->escape($type) . '</td><td><code>' . $this->escape($id) . '</code></td><td>' . $this->escape($from) . '</td><td>' . $this->escape($to) . '</td><td>' . $this->escape($date) . '</td><td>' . $rollback . '</td></tr>';
        }
        if ($rows === '') {
            $rows = '<tr><td colspan="6" class="muted">Все още няма записи.</td></tr>';
        }

        $html = <<<HTML
        <!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><link rel="icon" type="image/png" href="/assets/brand/favicon.png"><title>Обновявания · Flex CMS</title>
        <style>:root{--ink:#17211b;--muted:#69736c;--paper:#f4f5ef;--accent:#ff5c35;--line:#dce2dd;--red:#b42318;--green:#177a50;--blue:#2459a6;--sidebar:#18231d;--sidebar-muted:#aeb9b0;--sidebar-active:#2b3a31}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,sans-serif}.admin-shell{display:flex;min-height:100vh}.admin-main{min-width:0;flex:1}header{display:flex;justify-content:space-between;align-items:center;padding:22px max(24px,calc((100% - 1120px)/2));background:#fff;border-bottom:1px solid var(--line)}.brand{color:var(--accent);font-size:.78rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase}.user{color:var(--muted);font-size:.9rem}.user form{display:inline}.logout{border:0;background:transparent;color:var(--muted);font:inherit;cursor:pointer;text-decoration:underline}main{width:min(1120px,calc(100% - 48px));margin:44px auto}h1{margin:0 0 8px;font:500 clamp(2.4rem,5vw,4.5rem)/1 Georgia,serif;letter-spacing:-.04em}h2{margin-top:0;font-size:1.25rem}.lead,.muted{color:var(--muted)}.card{margin-top:28px;padding:26px;background:#fff;border:1px solid var(--line);border-radius:16px}.notice{margin:18px 0;padding:14px 16px;border-radius:10px}.success{background:#edf8f1;color:var(--green)}.error{background:#fff1f0;color:var(--red)}.info{background:#eef4ff;color:var(--blue)}label{display:block;margin:15px 0 6px;font-weight:700}input[type=file],input[type=text]{width:100%;padding:12px;border:1px solid #cbd3cd;border-radius:8px;font:inherit}button{margin-top:18px;padding:12px 18px;border:0;border-radius:8px;background:var(--ink);color:#fff;font:700 1rem system-ui;cursor:pointer}.small{margin:0;padding:7px 10px;font-size:.82rem}.danger{background:#8f1d14}table{width:100%;border-collapse:collapse}th,td{padding:12px 10px;text-align:left;border-bottom:1px solid var(--line);vertical-align:middle}th{font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}@media(max-width:720px){main{width:min(100% - 32px,1120px);margin:32px auto}}</style><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"><link rel="stylesheet" href="/assets/admin.css"><script src="/assets/vendor/react.production.min.js"></script><script src="/assets/vendor/react-dom.production.min.js"></script><script defer src="/assets/admin.js"></script></head><body{$devReloadAttribute} style="--sidebar-width:{$sidebarWidth}px"><div class="admin-shell">{$this->sidebar->render('updates', $sidebarWidth)}<div class="admin-main">
        <header><div class="topbar-spacer" aria-hidden="true"></div><div class="topbar-actions"><form method="post" action="/logout"><input type="hidden" name="_token" value="{$token}"><button class="logout" type="submit">Изход</button></form></div></header><main class="layout"><h1>Обновявания</h1><p class="lead">Качете ZIP пакет за версията и стартирайте контролирано обновяване с един бутон.</p>{$noticeMarkup}{$errorMarkup}{$inspectionMarkup}
        <section class="card"><h2>Качване на platform пакет</h2><form method="post" action="/admin/updates/install" enctype="multipart/form-data"><input type="hidden" name="_token" value="{$token}"><input type="hidden" name="mode" value="install"><label for="package">ZIP пакет на новата версия</label><input id="package" type="file" name="package" accept="application/zip,.zip" required><button type="submit">Актуализирай платформата</button></form><p class="muted">След качването системата автоматично изчислява checksum, проверява цифровия подпис и съвместимостта, прави backup, активира maintenance mode, изпълнява миграциите и прави health check. Не качвайте private signing key.</p></section>
        <section class="card"><h2>История</h2><div style="overflow:auto"><table><thead><tr><th>Тип</th><th>ID</th><th>От</th><th>До</th><th>Дата</th><th>Действие</th></tr></thead><tbody>{$rows}</tbody></table></div></section></main></div></div></body></html>
        HTML;

        return $html;
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
