<?php
declare(strict_types=1);
namespace Flex\Settings;
use Flex\Database\DatabaseManager;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;

final readonly class SectionSettings
{
    public function __construct(private DatabaseManager $database, private ConfigRepositoryInterface $configuration) {}
    /** @return array<string, string> */
    public function all(string $section): array
    {
        $values = match ($section) {
            'public' => ['home_page_id' => '0', 'closed' => '0', 'closed_message' => 'Сайтът временно е затворен. Моля, посетете ни отново по-късно.'],
            'users' => ['default_role' => 'user', 'require_email_verification' => '0', 'password_min_length' => '12', 'session_idle_minutes' => (string) $this->configuration->int('session.lifetime', 120)],
            'media' => ['max_upload_mb' => (string) $this->configuration->int('filesystems.media.max_upload_mb', 64), 'allow_images' => '1', 'allow_documents' => '1', 'allow_audio' => '1', 'allow_video' => '1', 'generate_thumbnails' => '1', 'thumbnail_edge' => '400'],
            'mail' => ['from_address' => '', 'from_name' => '', 'reply_to' => ''],
            'updates' => ['channel' => $this->configuration->string('extensions.updates.channel', 'stable'), 'catalog_timeout' => '10'],
            'admin' => ['theme' => 'system', 'remember_tabs' => '1'],
            'maintenance' => [],
            default => throw new \InvalidArgumentException('Непознат раздел.', 404),
        };
        foreach ($this->database->connection()->table('settings')->where('group', 'settings.' . $section)->get() as $row) {
            $key = substr((string) $row->key, strlen('settings.' . $section . '.'));
            if (array_key_exists($key, $values)) $values[$key] = (string) $row->value;
        }
        return $values;
    }
    /**
     * @param array<string, mixed> $input
     * @return array<string, string>
     */
    public function save(string $section, array $input): array
    {
        if ($section === 'maintenance') throw new \InvalidArgumentException('Диагностиката е само за преглед.', 405);
        $values = [];
        foreach ($this->all($section) as $key => $_) {
            if (!is_string($input[$key] ?? null)) throw new \InvalidArgumentException('Всички полета са задължителни.', 422);
            $values[$key] = trim($input[$key]);
        }
        if ($section === 'public') {
            if (!ctype_digit($values['home_page_id'])) throw new \InvalidArgumentException('Невалидна начална страница.', 422);
            if ($values['home_page_id'] !== '0' && !\Flex\Pages\Page::query()->where('id', (int) $values['home_page_id'])->where('status', 'published')->exists()) throw new \InvalidArgumentException('Изберете публикувана страница.', 422);
            if (!in_array($values['closed'], ['0', '1'], true) || $values['closed_message'] === '' || mb_strlen($values['closed_message']) > 1000) throw new \InvalidArgumentException('Невалиден режим или съобщение (до 1000 символа).', 422);
        } elseif ($section === 'users') {
            if (!in_array($values['default_role'], ['user', 'editor', 'admin'], true) || !in_array($values['require_email_verification'], ['0', '1'], true)) throw new \InvalidArgumentException('Невалидна роля или потвърждение.', 422);
            foreach (['password_min_length' => [12, 64], 'session_idle_minutes' => [5, 1440]] as $key => [$min, $max]) {
                if (!ctype_digit($values[$key]) || (int) $values[$key] < $min || (int) $values[$key] > $max) throw new \InvalidArgumentException("Стойността за $key трябва да е между $min и $max.", 422);
            }
        } elseif ($section === 'media') {
            foreach (['max_upload_mb' => [1, 1024], 'thumbnail_edge' => [100, 1200]] as $key => [$min, $max]) {
                if (!ctype_digit($values[$key]) || (int) $values[$key] < $min || (int) $values[$key] > $max) throw new \InvalidArgumentException("Стойността за $key трябва да е между $min и $max.", 422);
            }
            foreach (['allow_images', 'allow_documents', 'allow_audio', 'allow_video', 'generate_thumbnails'] as $key) {
                if (!in_array($values[$key], ['0', '1'], true)) throw new \InvalidArgumentException('Невалидна настройка за файлове.', 422);
            }
            if (!in_array('1', array_intersect_key($values, array_flip(['allow_images', 'allow_documents', 'allow_audio', 'allow_video'])), true)) throw new \InvalidArgumentException('Разрешете поне една категория файлове.', 422);
        } elseif ($section === 'mail') {
            foreach (['from_address', 'reply_to'] as $key) {
                if ($values[$key] !== '' && (strlen($values[$key]) > 190 || filter_var($values[$key], FILTER_VALIDATE_EMAIL) === false)) throw new \InvalidArgumentException('Въведете валиден имейл адрес.', 422);
            }
            if (mb_strlen($values['from_name']) > 150 || preg_match('/[\r\n\x00]/', $values['from_name'])) throw new \InvalidArgumentException('Невалидно име на подателя (до 150 символа).', 422);
        } elseif ($section === 'updates') {
            if (!in_array($values['channel'], ['stable', 'beta', 'dev'], true)) throw new \InvalidArgumentException('Невалиден канал за обновяване.', 422);
            if (!ctype_digit($values['catalog_timeout']) || (int) $values['catalog_timeout'] < 5 || (int) $values['catalog_timeout'] > 30) throw new \InvalidArgumentException('Времето за изчакване трябва да е между 5 и 30 секунди.', 422);
        } elseif ($section === 'admin') {
            if (!in_array($values['theme'], ['system', 'light', 'dark'], true) || !in_array($values['remember_tabs'], ['0', '1'], true)) throw new \InvalidArgumentException('Невалидни предпочитания на панела.', 422);
        }
        $this->database->transaction(function () use ($section, $values): void {
            foreach ($values as $key => $value) Setting::query()->updateOrCreate(['key' => "settings.$section.$key"], ['value' => $value, 'type' => 'string', 'group' => 'settings.' . $section, 'autoload' => true]);
        });
        return $this->all($section);
    }

    /** @return array{from_address: string, from_name: string, reply_to: string} */
    public function mailDefaults(): array
    {
        $values = $this->all('mail');
        return ['from_address' => $values['from_address'] !== '' ? $values['from_address'] : $this->configuration->string('mail.from.address', 'noreply@localhost'), 'from_name' => $values['from_name'] !== '' ? $values['from_name'] : $this->configuration->string('mail.from.name', 'Flex CMS'), 'reply_to' => $values['reply_to']];
    }

    /** @return array{transport: string, from_address: string, from_name: string} */
    public function mailOverview(): array
    {
        $scheme = strtolower((string) parse_url($this->configuration->string('mail.dsn', 'null://null'), PHP_URL_SCHEME));
        $defaults = $this->mailDefaults();
        return ['transport' => match ($scheme) { 'smtp' => 'SMTP', 'smtps' => 'SMTP с TLS', 'null' => 'Изпращането е изключено', default => 'Друг транспорт от .env' }, 'from_address' => $defaults['from_address'], 'from_name' => $defaults['from_name']];
    }
}
