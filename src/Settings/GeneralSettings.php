<?php

declare(strict_types=1);

namespace Flex\Settings;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Database\DatabaseManager;

final readonly class GeneralSettings
{
    public const DATE_FORMATS = ['d.m.Y', 'Y-m-d', 'd/m/Y', 'm/d/Y'];
    public const TIME_FORMATS = ['H:i', 'H:i:s', 'g:i A'];
    public function __construct(private DatabaseManager $database, private ConfigRepositoryInterface $configuration) {}

    /** @return array<string, string> */
    public function all(): array
    {
        $values = ['name' => $this->configuration->string('app.name', 'Flex CMS'), 'description' => '', 'locale' => 'bg', 'timezone' => $this->configuration->string('app.timezone', 'UTC'), 'date_format' => 'd.m.Y', 'time_format' => 'H:i'];
        foreach ($this->database->connection()->table('settings')->where('group', 'general')->get() as $row) {
            $key = substr((string) $row->key, strlen('site.'));
            if (array_key_exists($key, $values) && $row->key === 'site.' . $key) $values[$key] = (string) $row->value;
        }
        return $values;
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, string>
     */
    public function save(array $input): array
    {
        $values = [];
        foreach (array_keys($this->all()) as $key) {
            if (!is_string($input[$key] ?? null)) throw new \InvalidArgumentException('Всички полета са задължителни.', 422);
            $values[$key] = trim($input[$key]);
        }
        if ($values['name'] === '' || mb_strlen($values['name']) > 150) throw new \InvalidArgumentException('Името трябва да е между 1 и 150 символа.', 422);
        if (mb_strlen($values['description']) > 500) throw new \InvalidArgumentException('Описанието трябва да е до 500 символа.', 422);
        if (!in_array($values['locale'], ['bg', 'en'], true)) throw new \InvalidArgumentException('Невалиден език.', 422);
        if (!in_array($values['timezone'], \DateTimeZone::listIdentifiers(\DateTimeZone::ALL_WITH_BC), true)) throw new \InvalidArgumentException('Невалидна часова зона.', 422);
        if (!in_array($values['date_format'], self::DATE_FORMATS, true) || !in_array($values['time_format'], self::TIME_FORMATS, true)) throw new \InvalidArgumentException('Невалиден формат за дата или час.', 422);
        $this->database->transaction(function () use ($values): void {
            foreach ($values as $key => $value) {
                Setting::query()->updateOrCreate(['key' => 'site.' . $key], ['value' => $value, 'type' => 'string', 'group' => 'general', 'autoload' => true]);
            }
        });
        return $this->all();
    }

    public function formatDate(\DateTimeInterface $date): string
    {
        $settings = $this->all();
        return \DateTimeImmutable::createFromInterface($date)->setTimezone(new \DateTimeZone($settings['timezone']))->format($settings['date_format'] . ' ' . $settings['time_format']);
    }
}
