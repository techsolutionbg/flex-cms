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

    private function sidebarKey(int $userId): string
    {
        return 'admin.user.' . $userId . '.sidebar_width';
    }

    private function normalizeSidebarWidth(int $width): int
    {
        return max(self::MIN_SIDEBAR_WIDTH, min(self::MAX_SIDEBAR_WIDTH, $width));
    }
}
