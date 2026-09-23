<?php

declare(strict_types=1);

namespace Flex\Settings;

final class SettingRepository
{
    private const DEFAULT_SIDEBAR_WIDTH = 248;
    private const MIN_SIDEBAR_WIDTH = 180;
    private const MAX_SIDEBAR_WIDTH = 420;

    public function sidebarWidthForUser(int $userId): int
    {
        $setting = Setting::query()->find($this->sidebarKey($userId));
        $width = $setting instanceof Setting ? (int) $setting->getAttribute('value') : self::DEFAULT_SIDEBAR_WIDTH;

        return $this->normalizeSidebarWidth($width);
    }

    public function saveSidebarWidthForUser(int $userId, int $width): int
    {
        $width = $this->normalizeSidebarWidth($width);
        $setting = Setting::query()->find($this->sidebarKey($userId));
        if (!$setting instanceof Setting) {
            $setting = new Setting(['key' => $this->sidebarKey($userId)]);
        }
        $setting->fill([
            'value' => (string) $width,
            'type' => 'integer',
            'group' => 'admin',
            'autoload' => false,
        ]);
        $setting->saveOrFail();

        return $width;
    }

    public function sidebarCollapsedForUser(int $userId): bool
    {
        $setting = Setting::query()->find($this->sidebarCollapsedKey($userId));

        return $setting instanceof Setting && filter_var($setting->getAttribute('value'), FILTER_VALIDATE_BOOL);
    }

    public function saveSidebarCollapsedForUser(int $userId, bool $collapsed): bool
    {
        $setting = Setting::query()->find($this->sidebarCollapsedKey($userId));
        if (!$setting instanceof Setting) {
            $setting = new Setting(['key' => $this->sidebarCollapsedKey($userId)]);
        }
        $setting->fill([
            'value' => $collapsed ? '1' : '0',
            'type' => 'boolean',
            'group' => 'admin',
            'autoload' => false,
        ]);
        $setting->saveOrFail();

        return $collapsed;
    }

    /** @return array<string, bool> */
    public function collapsedSectionsForUser(int $userId): array
    {
        $setting = Setting::query()->find($this->collapsedSectionsKey($userId));
        if (!$setting instanceof Setting) {
            return [];
        }

        $value = json_decode((string) $setting->getAttribute('value'), true);

        return is_array($value) ? array_filter($value, static fn ($collapsed, $key): bool => is_string($key) && is_bool($collapsed), ARRAY_FILTER_USE_BOTH) : [];
    }

    public function saveCollapsedSectionForUser(int $userId, string $key, bool $collapsed): bool
    {
        $sections = $this->collapsedSectionsForUser($userId);
        if ($collapsed) {
            $sections[$key] = true;
        } else {
            unset($sections[$key]);
        }
        $setting = Setting::query()->find($this->collapsedSectionsKey($userId));
        if (!$setting instanceof Setting) {
            $setting = new Setting(['key' => $this->collapsedSectionsKey($userId)]);
        }
        $setting->fill([
            'value' => json_encode($sections, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            'type' => 'json',
            'group' => 'admin',
            'autoload' => false,
        ]);
        $setting->saveOrFail();

        return $collapsed;
    }

    private function sidebarKey(int $userId): string
    {
        return 'admin.user.' . $userId . '.sidebar_width';
    }

    private function sidebarCollapsedKey(int $userId): string
    {
        return 'admin.user.' . $userId . '.sidebar_collapsed';
    }

    private function collapsedSectionsKey(int $userId): string
    {
        return 'admin.user.' . $userId . '.collapsed_sections';
    }

    private function normalizeSidebarWidth(int $width): int
    {
        return max(self::MIN_SIDEBAR_WIDTH, min(self::MAX_SIDEBAR_WIDTH, $width));
    }
}
