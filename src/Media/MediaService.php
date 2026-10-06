<?php

declare(strict_types=1);

namespace Flex\Media;

use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Database\DatabaseManager;
use Psr\Http\Message\UploadedFileInterface;

final readonly class MediaService
{
    private const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'application/pdf' => 'pdf', 'audio/mpeg' => 'mp3', 'audio/ogg' => 'ogg', 'audio/wav' => 'wav', 'audio/x-wav' => 'wav', 'video/mp4' => 'mp4', 'video/webm' => 'webm'];

    public function __construct(private DatabaseManager $database, private ProjectPaths $paths, private ConfigRepositoryInterface $config, private ?\Flex\Settings\SectionSettings $settings = null) {}

    public function maxBytes(): int
    {
        $limit = max(1, (int) ($this->settings?->all('media')['max_upload_mb'] ?? $this->config->get('filesystems.media.max_upload_mb', 64))) * 1024 * 1024;
        foreach (['upload_max_filesize', 'post_max_size'] as $setting) {
            $value = (string) ini_get($setting);
            $bytes = (int) $value * match (strtolower(substr($value, -1))) {
                'g' => 1073741824, 'm' => 1048576, 'k' => 1024, default => 1,
            };
            if ($bytes > 0) {
                $limit = min($limit, $bytes - ($setting === 'post_max_size' ? 1048576 : 0));
            }
        }
        return max(1, $limit);
    }

    /** @return list<string> */
    public function allowedTypes(): array
    {
        $policy = $this->settings?->all('media');
        return array_values(array_filter(array_keys(self::TYPES), static function (string $mime) use ($policy): bool {
            $category = match (true) { str_starts_with($mime, 'image/') => 'allow_images', str_starts_with($mime, 'audio/') => 'allow_audio', str_starts_with($mime, 'video/') => 'allow_video', default => 'allow_documents' };
            return ($policy[$category] ?? '1') === '1';
        }));
    }

    /** @return list<array<string, mixed>> */
    public function index(string $view): array
    {
        if (!in_array($view, ['active', 'trash'], true)) {
            throw new MediaException('Невалиден изглед.', 422);
        }
        $query = $this->database->connection()->table('media');
        $view === 'trash' ? $query->whereNotNull('deleted_at') : $query->whereNull('deleted_at');
        return array_values($query->orderByDesc('id')->get()->map(fn($row) => $this->record($row))->all());
    }

    /** @return array<string, mixed> */
    public function get(int $id): array
    {
        $row = $this->database->connection()->table('media')->where('id', $id)->first();
        if ($row === null) {
            throw new MediaException('Файлът не е намерен.', 404);
        }
        $record = $this->record($row);
        $uploader = $this->database->connection()->table('users')->where('id', $row->uploaded_by)->first(['id', 'email']);
        $record['uploader'] = $uploader === null ? null : ['id' => (int) $uploader->id, 'email' => (string) $uploader->email];
        return $record;
    }

    /** @return array<string, mixed> */
    public function upload(UploadedFileInterface $upload, int $userId): array
    {
        if ($upload->getError() !== UPLOAD_ERR_OK) {
            throw new MediaException('Качването не завърши. Проверете размера на файла и опитайте отново.', 422);
        }
        $root = $this->paths->publicMedia();
        if (!is_dir($root) && !mkdir($root, 0770, true) && !is_dir($root)) {
            throw new MediaException('Директорията за медия не е достъпна.', 503);
        }
        $temporary = tempnam($root, '.upload-');
        if ($temporary === false) {
            throw new MediaException('Файлът не може да бъде записан.', 503);
        }
        $created = [$temporary];
        try {
            $upload->moveTo($temporary);
            $size = filesize($temporary);
            if ($size === false || $size < 1 || $size > $this->maxBytes()) {
                throw new MediaException('Файлът е празен или надвишава разрешения размер.', 422);
            }
            $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($temporary);
            if (!is_string($mime) || !isset(self::TYPES[$mime])) {
                throw new MediaException('Неподдържан тип файл. SVG, HTML и изпълними файлове не се приемат.', 422);
            }
            $policy = $this->settings?->all('media');
            $category = match (true) { str_starts_with($mime, 'image/') => 'allow_images', str_starts_with($mime, 'audio/') => 'allow_audio', str_starts_with($mime, 'video/') => 'allow_video', default => 'allow_documents' };
            if (($policy[$category] ?? '1') !== '1') throw new MediaException('Тази категория файлове е изключена в настройките на медийната библиотека.', 422);
            $width = $height = null;
            if (str_starts_with($mime, 'image/')) {
                $dimensions = @getimagesize($temporary);
                if ($dimensions === false || $dimensions[0] * $dimensions[1] > 16000000) {
                    throw new MediaException('Изображението е повредено или надвишава 16 мегапиксела.', 422);
                }
                [$width, $height] = $dimensions;
            }
            $directory = gmdate('Y/m');
            if (!is_dir($root . '/' . $directory) && !mkdir($root . '/' . $directory, 0770, true) && !is_dir($root . '/' . $directory)) {
                throw new MediaException('Файлът не може да бъде записан.', 503);
            }
            $key = bin2hex(random_bytes(16));
            $path = $directory . '/' . $key . '.' . self::TYPES[$mime];
            if (!rename($temporary, $root . '/' . $path)) {
                throw new MediaException('Файлът не може да бъде записан.', 503);
            }
            $created[] = $root . '/' . $path;
            $thumbnail = null;
            if ($width !== null && ($policy['generate_thumbnails'] ?? '1') === '1' && function_exists('imagecreatefromstring')) {
                $image = @imagecreatefromstring((string) file_get_contents($root . '/' . $path));
                if ($image === false) {
                    throw new MediaException('Изображението не може да бъде обработено.', 422);
                }
                $scale = min(1, (int) ($policy['thumbnail_edge'] ?? 400) / max($width, $height));
                $preview = imagecreatetruecolor(max(1, (int) ($width * $scale)), max(1, (int) ($height * $scale)));
                imagealphablending($preview, false);
                imagesavealpha($preview, true);
                imagecopyresampled($preview, $image, 0, 0, 0, 0, imagesx($preview), imagesy($preview), $width, $height);
                $thumbnail = $directory . '/' . $key . '-preview.png';
                $created[] = $root . '/' . $thumbnail;
                $written = imagepng($preview, $root . '/' . $thumbnail);
                imagedestroy($image);
                imagedestroy($preview);
                if (!$written) {
                    throw new MediaException('Миниатюрата не може да бъде записана.', 503);
                }
            }
            $name = mb_substr(basename(str_replace('\\', '/', $upload->getClientFilename() ?? 'file')), 0, 255);
            $now = gmdate('Y-m-d H:i:s');
            $id = $this->database->connection()->table('media')->insertGetId(['original_name' => $name, 'path' => $path, 'thumbnail_path' => $thumbnail, 'mime' => $mime, 'size' => $size, 'width' => $width, 'height' => $height, 'uploaded_by' => $userId, 'title' => $name, 'alt' => '', 'caption' => '', 'description' => '', 'created_at' => $now, 'updated_at' => $now]);
            return $this->get((int) $id);
        } catch (\Throwable $error) {
            foreach ($created as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
            throw $error;
        }
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function update(int $id, array $input): array
    {
        $record = $this->get($id);
        if ($record['deleted_at'] !== null) {
            throw new MediaException('Възстановете файла преди редактиране.', 409);
        }
        $values = ['updated_at' => gmdate('Y-m-d H:i:s')];
        foreach (['title' => 255, 'alt' => 255, 'caption' => 2000, 'description' => 10000] as $key => $length) {
            if (!isset($input[$key]) || !is_string($input[$key]) || mb_strlen($input[$key]) > $length) {
                throw new MediaException('Невалидни метаданни.', 422);
            }
            $values[$key] = trim($input[$key]);
        }
        $this->database->connection()->table('media')->where('id', $id)->update($values);
        return $this->get($id);
    }

    public function trash(int $id, bool $restore = false): void
    {
        $this->get($id);
        $this->database->connection()->table('media')->where('id', $id)->update(['deleted_at' => $restore ? null : gmdate('Y-m-d H:i:s'), 'updated_at' => gmdate('Y-m-d H:i:s')]);
    }

    /** @return list<array{id: int, title: string}> */
    public function usage(int $id): array
    {
        $this->get($id);
        return array_values($this->database->connection()->table('pages')->where(static function ($query) use ($id): void {
            $prefix = '/media-files/' . $id . '/';
            $query->where('content', 'like', '%' . $prefix . '%')->orWhere('featured_media_id', $id)
                ->orWhere('blocks', 'like', '%' . $prefix . '%')
                ->orWhere('blocks', 'like', '%' . str_replace('/', '\\/', $prefix) . '%');
        })->get(['id', 'title'])->map(static fn($row) => ['id' => (int) $row->id, 'title' => (string) $row->title])->all());
    }

    public function delete(int $id): void
    {
        $staged = [];
        try {
            $this->database->transaction(function () use ($id, &$staged): void {
                $this->database->connection()->table('media')->where('id', $id)->lockForUpdate()->first();
                $record = $this->get($id);
                if ($record['deleted_at'] === null) {
                    throw new MediaException('Първо преместете файла в кошчето.', 409);
                }
                if ($this->usage($id) !== []) {
                    throw new MediaException('Файлът се използва в страници. Премахнете връзките към него преди изтриване.', 409);
                }
                foreach (['path', 'thumbnail_path'] as $key) {
                    if (!is_string($record[$key])) {
                        continue;
                    }
                    $file = $this->paths->publicMedia($record[$key]);
                    $temporary = $this->paths->publicMedia('.deleted-' . bin2hex(random_bytes(16)));
                    if (is_file($file)) {
                        if (!rename($file, $temporary)) {
                            throw new MediaException('Файлът не може да бъде изтрит. Опитайте отново.', 503);
                        }
                        $staged[$file] = $temporary;
                    }
                }
                $this->database->connection()->table('media')->where('id', $id)->delete();
            });
        } catch (\Throwable $error) {
            foreach ($staged as $file => $temporary) {
                rename($temporary, $file);
            }
            throw $error;
        }
        foreach ($staged as $temporary) {
            if (!unlink($temporary)) {
                error_log('Media deletion cleanup failed for a staged file.');
            }
        }
    }

    /** @return array<string, mixed> */
    private function record(object $row): array
    {
        $record = (array) $row;
        $record['id'] = (int) $record['id'];
        $record['size'] = (int) $record['size'];
        $record['url'] = '/media-files/' . $record['id'] . '/original';
        $record['thumbnail_url'] = $record['thumbnail_path'] ? '/media-files/' . $record['id'] . '/thumbnail' : null;
        return $record;
    }
}
