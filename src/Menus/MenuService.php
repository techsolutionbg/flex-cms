<?php

declare(strict_types=1);

namespace Flex\Menus;

use Flex\Database\DatabaseManager;
use Flex\Themes\ThemeManager;
use Illuminate\Database\Connection;
use Illuminate\Support\Str;

final readonly class MenuService
{
    public function __construct(private DatabaseManager $database, private ThemeManager $themes) {}

    /** @return array<string, mixed> */
    public function index(string $view = 'active'): array
    {
        $db = $this->database->connection();
        $capabilities = $this->themes->capabilities();
        if (!in_array($view, ['active', 'trash'], true)) {
            throw new MenuException('Невалиден изглед на менюта.', 422);
        }
        $query = $db->table('menus');
        $view === 'trash' ? $query->whereNotNull('deleted_at') : $query->whereNull('deleted_at');
        $menus = $query->orderBy('name')->get()->map(fn($row) => $this->record($row))->all();
        $counts = $db->table('menu_items')->selectRaw('menu_id, COUNT(*) AS total')->groupBy('menu_id')->pluck('total', 'menu_id');
        $usage = $db->table('theme_menu_assignments')->get()->groupBy('menu_id');
        foreach ($menus as &$menu) {
            $menu['item_count'] = (int) ($counts[$menu['id']] ?? 0);
            $menu['assignments'] = ($usage[$menu['id']] ?? collect())->map(fn($row) => ['theme' => $row->theme_id, 'location' => $row->location])->all();
        }
        return $capabilities + ['menus' => $menus, 'assignments' => $this->assignments($capabilities['theme']), 'assignment_version' => $this->assignmentVersion($capabilities['theme'])];
    }

    /** @return array<string, mixed> */
    public function get(int $id): array
    {
        $db = $this->database->connection();
        $row = $db->table('menus')->where('id', $id)->whereNull('deleted_at')->first();
        if (!$row) {
            throw new MenuException('Менюто не е намерено.', 404);
        }
        $menu = $this->record($row);
        $menu['items'] = $db->table('menu_items')->where('menu_id', $id)->orderBy('position')->get()->map(fn($item) => [
            'id' => $item->item_key, 'parent_id' => $item->parent_key, 'label' => $item->label,
            'type' => $item->type, 'page_id' => $item->page_id === null ? null : (int) $item->page_id,
            'url' => $item->url ?? '', 'new_tab' => (bool) $item->new_tab,
            'seo_title' => $item->seo_title, 'aria_label' => $item->aria_label,
            'css_class' => $item->css_class, 'rel' => $item->rel,
        ])->all();
        return $menu;
    }

    /** @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function save(array $input, ?int $id = null): array
    {
        return $this->database->transaction(function (Connection $db) use ($input, $id): array {
            $this->lockTheme($db);
            $this->requireSupport();
            if ($id !== null) {
                $this->requireVersion($db, $id, $input['version'] ?? null);
            }
            $name = is_string($input['name'] ?? null) ? trim($input['name']) : '';
            $slug = is_string($input['slug'] ?? null) ? trim($input['slug']) : '';
            if ($name === '' || mb_strlen($name) > 120) {
                throw new MenuException('Името трябва да съдържа от 1 до 120 символа.', 422);
            }
            $status = array_key_exists('status', $input) ? $input['status'] : ($id === null ? 'active' : $this->get($id)['status']);
            if (!in_array($status, ['active', 'inactive', 'draft'], true)) {
                throw new MenuException('Невалиден статус на менюто.', 422);
            }
            if ($slug === '') {
                $base = rtrim(substr(Str::slug($name, '-', 'bg'), 0, 120), '-') ?: 'menu';
                $slug = $base;
                $suffix = 2;
                while ($db->table('menus')->where('slug', $slug)->when($id !== null, fn($query) => $query->where('id', '!=', $id))->exists()) {
                    $ending = '-' . $suffix++;
                    $slug = rtrim(substr($base, 0, 120 - strlen($ending)), '-') . $ending;
                }
            }
            if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) || strlen($slug) > 120) {
                throw new MenuException('Идентификаторът трябва да съдържа малки латински букви, цифри и тирета.', 422);
            }
            $unique = $db->table('menus')->where('slug', $slug);
            if ($id !== null) {
                $unique->where('id', '!=', $id);
            }
            if ($unique->exists()) {
                throw new MenuException('Идентификаторът вече се използва от друго меню.', 422);
            }
            $items = array_key_exists('items', $input) ? $this->validateItems($input['items']) : null;
            $now = gmdate('Y-m-d H:i:s');
            if ($id === null) {
                $id = (int) $db->table('menus')->insertGetId(['name' => $name, 'slug' => $slug, 'status' => $status, 'version' => 1, 'created_at' => $now, 'updated_at' => $now]);
            } else {
                $db->table('menus')->where('id', $id)->update(['name' => $name, 'slug' => $slug, 'status' => $status, 'version' => $db->raw('version + 1'), 'updated_at' => $now]);
            }
            if ($items !== null) {
                $db->table('menu_items')->where('menu_id', $id)->delete();
            }
            foreach ($items ?? [] as $position => $item) {
                $db->table('menu_items')->insert([
                    'menu_id' => $id, 'item_key' => $item['id'], 'parent_key' => $item['parent_id'], 'position' => $position,
                    'label' => $item['label'], 'type' => $item['type'], 'page_id' => $item['page_id'], 'url' => $item['url'], 'new_tab' => $item['new_tab'],
                    'seo_title' => $item['seo_title'], 'aria_label' => $item['aria_label'], 'css_class' => $item['css_class'], 'rel' => $item['rel'],
                ]);
            }
            return $this->get($id);
        });
    }

    /** @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function saveWithPlacement(array $input, ?int $id = null): array
    {
        return $this->database->transaction(function (Connection $db) use ($input, $id): array {
            $this->lockTheme($db);
            $capabilities = $this->requireSupport();
            $placement = $input['placement'] ?? null;
            if (!is_array($placement) || !array_key_exists('location', $placement)
                || ($placement['location'] !== null && !is_string($placement['location']))) {
                throw new MenuException('Невалидна локация на менюто.', 422);
            }
            $menu = $this->save($input, $id);
            $assignments = array_intersect_key($this->assignments($capabilities['theme']), $capabilities['menu_locations']);
            foreach ($assignments as $location => $menuId) {
                if ($menuId === $menu['id']) {
                    unset($assignments[$location]);
                }
            }
            if ($placement['location'] !== null) {
                $assignments[$placement['location']] = $menu['id'];
            }
            $index = $this->assign([
                'theme' => $placement['theme'] ?? null,
                'assignment_version' => $placement['assignment_version'] ?? null,
                'assignments' => $assignments,
            ]);
            return ['menu' => $menu, 'index' => $index];
        });
    }

    public function delete(int $id, mixed $version): void
    {
        $this->database->transaction(function (Connection $db) use ($id, $version): void {
            $this->lockTheme($db);
            $this->requireSupport();
            $this->requireVersion($db, $id, $version, true);
            $db->table('theme_menu_assignments')->where('menu_id', $id)->delete();
            $db->table('menu_items')->where('menu_id', $id)->delete();
            $db->table('menus')->where('id', $id)->delete();
        });
    }

    public function trash(int $id, mixed $version): void
    {
        $this->database->transaction(function (Connection $db) use ($id, $version): void {
            $this->lockTheme($db);
            $this->requireSupport();
            $this->requireVersion($db, $id, $version);
            $now = gmdate('Y-m-d H:i:s');
            $db->table('menus')->where('id', $id)->update(['deleted_at' => $now, 'updated_at' => $now, 'version' => $db->raw('version + 1')]);
        });
    }

    public function restore(int $id, mixed $version): void
    {
        $this->database->transaction(function (Connection $db) use ($id, $version): void {
            $this->lockTheme($db);
            $this->requireSupport();
            $this->requireVersion($db, $id, $version, true);
            $db->table('menus')->where('id', $id)->update(['deleted_at' => null, 'updated_at' => gmdate('Y-m-d H:i:s'), 'version' => $db->raw('version + 1')]);
        });
    }

    /** @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function assign(array $input): array
    {
        return $this->database->transaction(function (Connection $db) use ($input): array {
            $this->lockTheme($db);
            $capabilities = $this->requireSupport();
            $theme = $capabilities['theme'];
            if (($input['theme'] ?? null) !== $theme) {
                throw new MenuException('Активната тема е сменена. Презаредете локациите.', 409);
            }
            if (($input['assignment_version'] ?? null) !== $this->assignmentVersion($theme)) {
                throw new MenuException('Локациите са променени от друг редактор. Презаредете ги.', 409);
            }
            $assignments = $input['assignments'] ?? null;
            if (!is_array($assignments)) {
                throw new MenuException('Невалидни присвоявания.', 422);
            }
            foreach ($assignments as $location => $menuId) {
                if (!array_key_exists($location, $capabilities['menu_locations'])) {
                    throw new MenuException('Локацията не съществува в активната тема.', 422);
                }
                if ($menuId !== null && (!is_int($menuId) || !$db->table('menus')->where('id', $menuId)->whereNull('deleted_at')->exists())) {
                    throw new MenuException('Избраното меню не съществува.', 422);
                }
            }
            $db->table('theme_menu_assignments')->where('theme_id', $theme)->whereIn('location', array_keys($capabilities['menu_locations']))->delete();
            foreach ($assignments as $location => $menuId) {
                if ($menuId !== null) {
                    $db->table('theme_menu_assignments')->insert(['theme_id' => $theme, 'location' => $location, 'menu_id' => $menuId]);
                }
            }
            return $this->index();
        });
    }

    /** @return array<string, int> */
    public function assignments(?string $theme): array
    {
        if ($theme === null) {
            return [];
        }
        return $this->database->connection()->table('theme_menu_assignments')->join('menus', 'menus.id', '=', 'theme_menu_assignments.menu_id')->whereNull('menus.deleted_at')->where('theme_id', $theme)->orderBy('location')->pluck('menu_id', 'location')->map(fn($id) => (int) $id)->all();
    }

    public function assignmentVersion(?string $theme): string
    {
        return hash('sha256', json_encode($this->assignments($theme), JSON_THROW_ON_ERROR));
    }

    /** @return array{theme: string|null, supports: array{menus: bool}, menu_locations: array<string, string>} */
    private function requireSupport(): array
    {
        $capabilities = $this->themes->capabilities();
        if (!$capabilities['supports']['menus']) {
            throw new MenuException('Активната тема не поддържа управление на менюта.', 403);
        }
        return $capabilities;
    }

    private function lockTheme(Connection $db): void
    {
        $db->table('settings')->where('key', 'site.active_theme')->lockForUpdate()->first();
    }

    private function requireVersion(Connection $db, int $id, mixed $version, bool $trashed = false): void
    {
        $menu = $db->table('menus')->where('id', $id)->lockForUpdate()->first();
        if (!$menu) {
            throw new MenuException('Менюто не е намерено.', 404);
        }
        if (!is_int($version) || $version !== (int) $menu->version) {
            throw new MenuException('Менюто е променено след отварянето му. Презаредете данните преди запис.', 409);
        }
        if (($menu->deleted_at !== null) !== $trashed) {
            throw new MenuException($trashed ? 'Менюто трябва първо да бъде преместено в кошчето.' : 'Менюто е в кошчето. Възстановете го преди редакция.', 409);
        }
    }

    /** @return array{id: int, name: string, slug: string, status: string, version: int, updated_at: string, deleted_at: string|null} */
    private function record(\stdClass $row): array
    {
        return ['id' => (int) $row->id, 'name' => (string) $row->name, 'slug' => (string) $row->slug, 'status' => (string) $row->status, 'version' => (int) $row->version, 'updated_at' => (string) $row->updated_at, 'deleted_at' => $row->deleted_at];
    }

    /** @return list<array{id: string, parent_id: string|null, label: string, type: string, page_id: int|null, url: string|null, new_tab: bool, seo_title: string, aria_label: string, css_class: string, rel: string}> */
    private function validateItems(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value) || count($value) > 100) {
            throw new MenuException('Менюто може да съдържа до 100 елемента.', 422);
        }
        $items = [];
        $byId = [];
        foreach ($value as $item) {
            if (!is_array($item)) {
                throw new MenuException('Невалиден елемент.', 422);
            }
            $id = $item['id'] ?? '';
            $parent = $item['parent_id'] ?? null;
            if (!is_string($id) || !preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $id) || isset($byId[$id]) || ($parent !== null && !is_string($parent))) {
                throw new MenuException('Невалиден или повторен идентификатор на елемент.', 422);
            }
            $label = is_string($item['label'] ?? null) ? trim($item['label']) : '';
            if ($label === '' || mb_strlen($label) > 190) {
                throw new MenuException('Всеки елемент трябва да има заглавие до 190 символа.', 422);
            }
            $type = $item['type'] ?? '';
            $pageId = null;
            $url = null;
            if ($type === 'page') {
                $pageId = $item['page_id'] ?? null;
                if (!is_int($pageId) || !$this->database->connection()->table('pages')->where('id', $pageId)->whereNull('deleted_at')->exists()) {
                    throw new MenuException('Изберете съществуваща страница за елемента.', 422);
                }
                $override = is_string($item['url'] ?? null) ? trim($item['url']) : '';
                if ($override !== '' && !self::safeUrl($override)) {
                    throw new MenuException('Невалиден адрес на елемента.', 422);
                }
                $url = $override === '' ? null : $override;
            } elseif ($type === 'link') {
                $url = is_string($item['url'] ?? null) ? trim($item['url']) : '';
                if (!self::safeUrl($url)) {
                    throw new MenuException('Линкът трябва да е HTTP(S) адрес, вътрешен път /… или котва #… .', 422);
                }
            } else {
                throw new MenuException('Неподдържан тип елемент.', 422);
            }
            if (!is_bool($item['new_tab'] ?? false)) {
                throw new MenuException('Невалидна настройка за нов таб.', 422);
            }
            $attributes = ['seo_title' => '', 'aria_label' => '', 'css_class' => '', 'rel' => ''];
            foreach (['seo_title' => 190, 'aria_label' => 190, 'css_class' => 190, 'rel' => 120] as $attribute => $limit) {
                $value = $item[$attribute] ?? '';
                if (!is_string($value) || mb_strlen($value) > $limit || preg_match('/[\x00-\x1f\x7f]/', $value)) {
                    throw new MenuException('Невалидна стойност за атрибут ' . $attribute . '.', 422);
                }
                $attributes[$attribute] = trim($value);
            }
            if ($attributes['css_class'] !== '' && !preg_match('/^[a-zA-Z0-9_-]+(?: +[a-zA-Z0-9_-]+)*$/', $attributes['css_class'])) {
                throw new MenuException('CSS класовете трябва да съдържат букви, цифри, тирета и долни черти, разделени с интервал.', 422);
            }
            $rel = $attributes['rel'] === '' ? [] : preg_split('/ +/', strtolower($attributes['rel']));
            if (!is_array($rel) || array_diff($rel, ['nofollow', 'sponsored', 'ugc', 'external', 'noopener', 'noreferrer']) !== []) {
                throw new MenuException('Неподдържан rel атрибут.', 422);
            }
            $attributes['rel'] = implode(' ', array_unique($rel));
            $byId[$id] = count($items);
            $items[] = ['id' => $id, 'parent_id' => $parent, 'label' => $label, 'type' => $type, 'page_id' => $pageId, 'url' => $url, 'new_tab' => $item['new_tab'] ?? false] + $attributes;
        }
        foreach ($items as $item) {
            $trail = [$item['id'] => true];
            $parent = $item['parent_id'];
            $depth = 1;
            while ($parent !== null) {
                if (!isset($byId[$parent]) || isset($trail[$parent]) || ++$depth > 3) {
                    throw new MenuException('Подменютата трябва да са до три нива, без цикли и липсващи родители.', 422);
                }
                $trail[$parent] = true;
                $parent = $items[$byId[$parent]]['parent_id'];
            }
        }
        return $items;
    }

    public static function safeUrl(string $url): bool
    {
        if ($url === '' || strlen($url) > 2048 || preg_match('/[\x00-\x20\x7f\\\\]/', $url)) {
            return false;
        }
        if (str_starts_with($url, '/') && !str_starts_with($url, '//')) {
            return true;
        }
        if (preg_match('/^#[a-zA-Z0-9_-]+$/', $url)) {
            return true;
        }
        $parts = parse_url($url);
        return filter_var($url, FILTER_VALIDATE_URL) !== false && is_array($parts) && in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) && !isset($parts['user']) && !isset($parts['pass']);
    }
}
