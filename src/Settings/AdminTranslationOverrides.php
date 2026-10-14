<?php

declare(strict_types=1);

namespace Flex\Settings;

use Flex\Database\DatabaseManager;

final readonly class AdminTranslationOverrides
{
    private const SETTING_KEY = 'admin.translations.overrides';
    private const MAX_CATALOG_BYTES = 2_000_000;
    private const MAX_ENTRIES = 10_000;

    public function __construct(private DatabaseManager $database) {}

    /** @return array<string, array<string, array<string, string>>> */
    public function all(): array
    {
        $value = $this->database->connection()->table('settings')->where('key', self::SETTING_KEY)->value('value');
        if (!is_string($value) || $value === '') {
            return [];
        }

        try {
            $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return [];
        }

        if (!is_array($decoded)) {
            return [];
        }

        // Platform-managed overrides are intentionally limited to the core catalog.
        // Plugin translations belong to each plugin's packaged locale files.
        $coreOverrides = [];
        foreach ($decoded as $locale => $catalogs) {
            if (is_string($locale) && is_array($catalogs) && isset($catalogs['core']) && is_array($catalogs['core'])) {
                $coreOverrides[$locale] = ['core' => $catalogs['core']];
            }
        }

        return $coreOverrides;
    }

    /** @param array<string, mixed> $input
     *  @return array<string, array<string, array<string, string>>>
     */
    public function save(array $input): array
    {
        $locale = $input['locale'] ?? null;
        $catalog = $input['catalog'] ?? null;
        if (!is_string($locale) || strlen($locale) > 16 || preg_match('/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/D', $locale) !== 1) {
            throw new \InvalidArgumentException('Invalid language identifier.', 422);
        }
        if (!is_array($catalog)) {
            throw new \InvalidArgumentException('Translation catalog must be an object.', 422);
        }

        $entries = 0;
        foreach ($catalog as $namespace => $translations) {
            if ($namespace !== 'core' || !is_array($translations)) {
                throw new \InvalidArgumentException('Invalid translation namespace.', 422);
            }
            foreach ($translations as $source => $translation) {
                if (!is_string($source) || $source === '' || mb_strlen($source) > 2000 || !is_string($translation) || mb_strlen($translation) > 10_000) {
                    throw new \InvalidArgumentException('Invalid translation entry.', 422);
                }
                preg_match_all('/\{([a-zA-Z0-9_]+)\}/', $source, $sourcePlaceholders);
                preg_match_all('/\{([a-zA-Z0-9_]+)\}/', $translation, $translationPlaceholders);
                $expected = $sourcePlaceholders[0];
                $actual = $translationPlaceholders[0];
                sort($expected);
                sort($actual);
                if ($expected !== $actual) {
                    throw new \InvalidArgumentException('A translation must preserve all named placeholders from its source text.', 422);
                }
                $entries++;
                if ($entries > self::MAX_ENTRIES) {
                    throw new \InvalidArgumentException('The translation catalog contains too many entries.', 422);
                }
            }
        }

        $overrides = $this->all();
        $overrides[$locale] = $catalog;
        try {
            $encoded = json_encode($overrides, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new \InvalidArgumentException('The translation catalog could not be encoded.', 422, $exception);
        }
        if (strlen($encoded) > self::MAX_CATALOG_BYTES) {
            throw new \InvalidArgumentException('The saved translation catalogs exceed the size limit.', 422);
        }

        $this->database->transaction(static function () use ($encoded): void {
            Setting::query()->updateOrCreate(
                ['key' => self::SETTING_KEY],
                ['value' => $encoded, 'type' => 'json', 'group' => 'admin.translations', 'autoload' => false],
            );
        });

        return $overrides;
    }
}
