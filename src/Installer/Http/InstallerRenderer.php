<?php

declare(strict_types=1);

namespace Flex\Installer\Http;

use Flex\Installer\RequirementsReport;

final class InstallerRenderer
{
    /** @param array<string, string> $values */
    public function form(RequirementsReport $report, string $csrfToken, array $values = [], ?string $error = null): string
    {
        $errorMarkup = $error === null ? '' : '<div class="alert" role="alert">' . $this->escape($error) . '</div>';
        $databasePassword = array_key_exists('database_password', $values) ? '' : 'flex_cms';
        $defaultAdminPassword = array_key_exists('admin_password', $values) ? '' : bin2hex(random_bytes(12));
        $adminPasswordNote = $defaultAdminPassword === ''
            ? ''
            : '<p class="field-note">Generated password: <code>' . $this->escape($defaultAdminPassword) . '</code>. Change it before production use.</p>';

        return $this->layout('Install Flex CMS', <<<HTML
            <header>
                <p class="eyebrow">Flex CMS</p>
                <h1>Let’s build your site.</h1>
                <p class="lead">Check the server, connect MySQL and create the first administrator.</p>
            </header>
            {$errorMarkup}
            <form method="post" action="/install" autocomplete="off">
                <input type="hidden" name="csrf_token" value="{$this->escape($csrfToken)}">
                <section>
                    <div class="section-heading"><span>01</span><div><h2>Website</h2><p>The public identity and regional defaults.</p></div></div>
                    <div class="grid">
                        {$this->field('site_name', 'Site name', $values['site_name'] ?? 'Flex CMS', 'text', 'My new website')}
                        {$this->field('site_url', 'Site URL', $values['site_url'] ?? $this->suggestedUrl(), 'url', 'https://example.com')}
                        {$this->field('timezone', 'Timezone', $values['timezone'] ?? 'Europe/Sofia', 'text', 'Europe/Sofia')}
                        {$this->field('locale', 'Locale', $values['locale'] ?? 'bg', 'text', 'bg')}
                    </div>
                </section>
                <section>
                    <div class="section-heading"><span>02</span><div><h2>MySQL database</h2><p>Use an empty MySQL 8 database and a user with schema permissions.</p></div></div>
                    <div class="grid">
                        {$this->field('database_host', 'Host', $values['database_host'] ?? 'localhost', 'text', 'localhost')}
                        {$this->field('database_port', 'Port', $values['database_port'] ?? '3306', 'number', '3306')}
                        {$this->field('database_name', 'Database', $values['database_name'] ?? 'flex_cms', 'text', 'flex_cms')}
                        {$this->field('database_username', 'Username', $values['database_username'] ?? 'flex_cms', 'text', 'flex_cms')}
                        {$this->field('database_password', 'Password', $databasePassword, 'password', 'flex_cms')}
                    </div>
                </section>
                <section>
                    <div class="section-heading"><span>03</span><div><h2>Administrator</h2><p>This account receives full platform access and is created as the first super administrator.</p></div></div>
                    <div class="grid">
                        {$this->field('admin_name', 'Full name', $values['admin_name'] ?? 'Administrator', 'text', 'Administrator')}
                        {$this->field('admin_email', 'Email', $values['admin_email'] ?? 'admin@example.com', 'email', 'admin@example.com')}
                        {$this->field('admin_password', 'Password', $defaultAdminPassword, 'password', 'Generated automatically')}
                        {$adminPasswordNote}
                    </div>
                </section>
                <button type="submit">Install Flex CMS <span>→</span></button>
            </form>
        HTML);
    }

    public function success(string $siteUrl): string
    {
        $url = $this->escape($siteUrl);

        return $this->layout('Flex CMS is ready', <<<HTML
            <main class="success">
                <div class="success-mark">✓</div>
                <p class="eyebrow">Installation complete</p>
                <h1>Your foundation is ready.</h1>
                <p class="lead">Flex CMS, the database schema and your administrator account were created successfully.</p>
                <a class="button" href="{$url}">Open the website <span>→</span></a>
            </main>
        HTML);
    }

    public function unavailable(): string
    {
        return $this->layout('Installer unavailable', <<<HTML
            <main class="success">
                <p class="eyebrow">Flex CMS</p>
                <h1>The installer is locked.</h1>
                <p class="lead">This installation is already configured. Remove neither the environment file nor the installation marker.</p>
                <a class="button" href="/">Return to the website <span>→</span></a>
            </main>
        HTML);
    }

    private function field(string $name, string $label, string $value, string $type, string $placeholder): string
    {
        return sprintf(
            '<label><span>%s</span><input name="%s" type="%s" value="%s" placeholder="%s" required></label>',
            $this->escape($label),
            $this->escape($name),
            $this->escape($type),
            $this->escape($value),
            $this->escape($placeholder),
        );
    }

    private function suggestedUrl(): string
    {
        $host = preg_replace('/[^a-zA-Z0-9.:[\]-]/', '', $_SERVER['HTTP_HOST'] ?? 'localhost');

        $scheme = ($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off' ? 'https' : 'http';

        return $scheme . '://' . ($host ?: 'localhost');
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private function layout(string $title, string $content): string
    {
        $title = $this->escape($title);

        return <<<HTML
        <!doctype html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="robots" content="noindex,nofollow">
            <title>{$title}</title>
            <style>
                :root{color-scheme:light;--ink:#17211b;--muted:#657068;--line:#dce2dd;--paper:#f4f5ef;--card:#fff;--accent:#ff5c35;--green:#177a50;--red:#b42318}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 10% 0,#fff 0,transparent 35%),var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body:before{content:"";display:block;height:7px;background:linear-gradient(90deg,var(--accent) 0 32%,#f7b32b 32% 58%,#2d6cdf 58%)}header,form,.success{width:min(980px,calc(100% - 32px));margin:auto}header{padding:72px 0 38px}.eyebrow{margin:0 0 12px;color:var(--accent);font-size:.78rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase}h1{max-width:760px;margin:0;font-family:Georgia,serif;font-size:clamp(2.6rem,7vw,5.7rem);font-weight:500;letter-spacing:-.045em;line-height:.95}.lead{max-width:660px;margin:24px 0 0;color:var(--muted);font-size:1.15rem}form{padding-bottom:80px}section{margin:18px 0;padding:28px;background:color-mix(in srgb,var(--card) 92%,transparent);border:1px solid var(--line);border-radius:18px;box-shadow:0 18px 50px rgba(23,33,27,.05)}.section-heading{display:flex;gap:18px;align-items:flex-start;margin-bottom:24px}.section-heading>span{display:grid;width:40px;height:40px;place-items:center;border:1px solid var(--line);border-radius:50%;font-size:.75rem;font-weight:800}.section-heading h2{margin:0;font-family:Georgia,serif;font-size:1.65rem;font-weight:500}.section-heading p{margin:3px 0 0;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}label span{display:block;margin-bottom:7px;font-size:.8rem;font-weight:750;letter-spacing:.04em;text-transform:uppercase}input{width:100%;padding:13px 14px;background:#fbfcf9;border:1px solid #cbd3cd;border-radius:9px;color:var(--ink);font:inherit;outline:none}input:focus{border-color:#2d6cdf;box-shadow:0 0 0 3px rgba(45,108,223,.12)}.requirements{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}.requirement{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:8px;background:#f7f8f5;font-size:.88rem}.requirement:before{content:"●"}.requirement.passed:before{color:var(--green)}.requirement.failed:before{color:var(--red)}.requirement small{margin-left:auto;color:var(--muted);overflow-wrap:anywhere}.alert{width:min(980px,calc(100% - 32px));margin:0 auto 18px;padding:16px 18px;border:1px solid #f2b8b5;border-radius:10px;background:#fff1f0;color:var(--red)}button,.button{display:inline-flex;align-items:center;justify-content:center;gap:28px;margin-top:18px;padding:16px 24px;border:0;border-radius:10px;background:var(--ink);color:#fff;font:700 1rem system-ui;text-decoration:none;cursor:pointer}button{width:100%}button:disabled{cursor:not-allowed;opacity:.45}.success{padding:15vh 0}.success-mark{display:grid;width:72px;height:72px;margin-bottom:28px;place-items:center;border-radius:50%;background:var(--green);color:#fff;font-size:2rem}@media(max-width:700px){header{padding-top:48px}.grid,.requirements{grid-template-columns:1fr}section{padding:20px}h1{font-size:3rem}}
            </style>
        </head>
        <body>{$content}</body>
        </html>
        HTML;
    }
}
