(function () {
    'use strict';

    var h = window.React && window.React.createElement;
    var reactRoot = null;
    var minWidth = 180;
    var maxWidth = 420;
    var breakpoint = 768;
    var storageKey = 'flexcms.admin.sidebarCollapsed';
    var collapsed = false;
    var mobileOpen = false;
    var width = 248;

    function AdminApp(props) { return h('div', { dangerouslySetInnerHTML: { __html: props.html } }); }
    function getApp(doc) { return doc.getElementById('flex-admin-app') || doc.querySelector('.admin-shell'); }
    function isMobile() { return window.innerWidth <= breakpoint; }
    function widthLimit() { return Math.max(minWidth, Math.min(maxWidth, window.innerWidth - 320)); }
    function clamp(value) { return Math.max(minWidth, Math.min(widthLimit(), Math.round(value))); }

    function elements() {
        return {
            sidebar: document.querySelector('.admin-sidebar'),
            toggle: document.querySelector('.sidebar-toggle'),
            handle: document.querySelector('.sidebar-resizer'),
            backdrop: document.querySelector('.sidebar-backdrop')
        };
    }

    function persist(value) {
        var token = document.querySelector('input[name="_token"]');
        if (!token) { return; }
        fetch('/admin/sidebar-width', {
            method: 'POST',
            body: new URLSearchParams({ _token: token.value, width: String(Math.round(value)) }),
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
        }).catch(function () {});
    }

    function updateToggle(toggle, expanded) {
        var label = expanded ? 'Прибери страничната лента' : 'Покажи страничната лента';
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        toggle.setAttribute('aria-label', label);
        toggle.setAttribute('title', label);
        var icon = toggle.querySelector('.sidebar-toggle-icon');
        if (icon) { icon.className = 'bi ' + (expanded ? 'bi-layout-sidebar-inset' : 'bi-layout-sidebar-inset-reverse') + ' sidebar-toggle-icon'; }
    }

    function applyState() {
        var ui = elements();
        if (!ui.sidebar || !ui.toggle) { return; }
        var mobile = isMobile();
        var expanded = mobile ? mobileOpen : !collapsed;
        document.documentElement.style.setProperty('--sidebar-width', width + 'px');
        document.body.classList.add('sidebar-enhanced');
        document.body.classList.toggle('sidebar-collapsed', !mobile && collapsed);
        document.body.classList.toggle('sidebar-mobile-open', mobile && mobileOpen);
        ui.sidebar.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        updateToggle(ui.toggle, expanded);
        if (ui.handle) {
            ui.handle.setAttribute('aria-valuenow', String(width));
            ui.handle.setAttribute('aria-disabled', mobile || collapsed ? 'true' : 'false');
            ui.handle.tabIndex = mobile || collapsed ? -1 : 0;
        }
        if (ui.backdrop) { ui.backdrop.hidden = !(mobile && mobileOpen); }
    }

    function initialize() {
        var sidebar = document.querySelector('.admin-sidebar');
        if (!sidebar) { return; }
        var configured = Number.parseInt(sidebar.dataset.sidebarWidth, 10);
        if (Number.isFinite(configured)) { width = Math.max(minWidth, Math.min(maxWidth, configured)); }
        applyState();
    }

    function renderAdmin(html) {
        var root = getApp(document);
        if (!root || !window.React || !window.ReactDOM) { return; }
        reactRoot = reactRoot || window.ReactDOM.createRoot(root);
        reactRoot.render(h(AdminApp, { html: html }));
        window.requestAnimationFrame(initialize);
    }

    function closeMobile(restoreFocus) {
        if (!mobileOpen) { return; }
        mobileOpen = false;
        applyState();
        var toggle = document.querySelector('.sidebar-toggle');
        if (restoreFocus && toggle) { toggle.focus(); }
    }

    function bindToggle() {
        document.addEventListener('click', function (event) {
            if (event.target.closest('.sidebar-toggle')) {
                if (isMobile()) { mobileOpen = !mobileOpen; }
                else {
                    collapsed = !collapsed;
                    try { window.localStorage.setItem(storageKey, collapsed ? '1' : '0'); } catch (error) {}
                }
                applyState();
            } else if (event.target.closest('.sidebar-backdrop')) {
                closeMobile(true);
            } else if (isMobile() && mobileOpen && event.target.closest('.sidebar-link')) {
                closeMobile(false);
            }
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && isMobile()) { closeMobile(true); }
        });
    }

    function bindResize() {
        var active = null;
        var pending = null;
        var frame = null;

        function draw() {
            frame = null;
            if (pending === null) { return; }
            width = clamp(pending);
            document.documentElement.style.setProperty('--sidebar-width', width + 'px');
            var handle = document.querySelector('.sidebar-resizer');
            if (handle) { handle.setAttribute('aria-valuenow', String(width)); }
        }
        function queue(value) {
            pending = value;
            if (frame === null) { frame = window.requestAnimationFrame(draw); }
        }
        function finish() {
            if (!active) { return; }
            if (frame !== null) { window.cancelAnimationFrame(frame); draw(); }
            document.body.classList.remove('sidebar-is-resizing');
            persist(width);
            active = null;
            pending = null;
        }

        document.addEventListener('pointerdown', function (event) {
            var handle = event.target.closest('.sidebar-resizer');
            if (!handle || isMobile() || collapsed || event.button !== 0) { return; }
            active = handle;
            handle.setPointerCapture(event.pointerId);
            document.body.classList.add('sidebar-is-resizing');
            queue(event.clientX);
            event.preventDefault();
        });
        document.addEventListener('pointermove', function (event) { if (active) { queue(event.clientX); } });
        document.addEventListener('pointerup', finish);
        document.addEventListener('pointercancel', finish);
        document.addEventListener('keydown', function (event) {
            var handle = event.target.closest('.sidebar-resizer');
            if (!handle || isMobile() || collapsed) { return; }
            var next = width;
            if (event.key === 'ArrowLeft') { next -= event.shiftKey ? 32 : 8; }
            else if (event.key === 'ArrowRight') { next += event.shiftKey ? 32 : 8; }
            else if (event.key === 'Home') { next = minWidth; }
            else if (event.key === 'End') { next = widthLimit(); }
            else { return; }
            event.preventDefault();
            width = clamp(next);
            applyState();
            persist(width);
        });
        window.addEventListener('resize', function () {
            if (!isMobile()) {
                width = clamp(width);
                mobileOpen = false;
            }
            applyState();
        });
    }

    function navigate(url, replace) {
        return fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            .then(function (response) { if (!response.ok) { throw new Error('Navigation failed'); } return response.text(); })
            .then(function (markup) {
                var parsed = new DOMParser().parseFromString(markup, 'text/html');
                var app = getApp(parsed);
                if (!app) { window.location.href = url; return; }
                document.title = parsed.title;
                renderAdmin(app.innerHTML);
                (replace ? window.history.replaceState : window.history.pushState).call(window.history, {}, '', url);
            });
    }

    function bindSpa() {
        document.addEventListener('click', function (event) {
            var link = event.target.closest('a[href]');
            if (!link || link.target || link.hasAttribute('download') || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) { return; }
            var url = new URL(link.href, window.location.href);
            if (url.origin !== window.location.origin || !url.pathname.startsWith('/admin')) { return; }
            event.preventDefault();
            navigate(url.href, false).catch(function () { window.location.href = url.href; });
        });
        document.addEventListener('submit', function (event) {
            var form = event.target;
            var action = new URL(form.action, window.location.href);
            if (!form.matches('form') || action.origin !== window.location.origin || !action.pathname.startsWith('/admin')) { return; }
            event.preventDefault();
            fetch(action.href, { method: form.method || 'POST', body: new FormData(form), credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
                .then(function (response) { return response.text().then(function (markup) { return { response: response, markup: markup }; }); })
                .then(function (result) {
                    var parsed = new DOMParser().parseFromString(result.markup, 'text/html');
                    var app = getApp(parsed);
                    if (!app) { window.location.reload(); return; }
                    document.title = parsed.title;
                    renderAdmin(app.innerHTML);
                    window.history.replaceState({}, '', result.response.url);
                }).catch(function () { form.submit(); });
        });
        window.addEventListener('popstate', function () { navigate(window.location.href, true).catch(function () { window.location.reload(); }); });
    }

    function watchForChanges() {
        if (document.body.dataset.flexDevReload !== 'true') { return; }
        var currentToken = null;
        var check = function () {
            fetch('/admin/dev/reload-token', { credentials: 'same-origin', cache: 'no-store', headers: { 'Accept': 'application/json' } })
                .then(function (response) { return response.ok ? response.json() : null; })
                .then(function (payload) {
                    if (!payload || !payload.token) { return; }
                    if (currentToken !== null && currentToken !== payload.token) { window.location.reload(); return; }
                    currentToken = payload.token;
                }).catch(function () {});
        };
        check();
        window.setInterval(check, 1000);
    }

    document.addEventListener('DOMContentLoaded', function () {
        try { collapsed = window.localStorage.getItem(storageKey) === '1'; } catch (error) {}
        var app = getApp(document);
        if (app && window.React && window.ReactDOM) {
            renderAdmin(app.innerHTML);
            bindSpa();
            bindResize();
            bindToggle();
            initialize();
        }
        watchForChanges();
    });
}());
