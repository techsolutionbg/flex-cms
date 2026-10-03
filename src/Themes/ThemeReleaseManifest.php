<?php

declare(strict_types=1);

namespace Flex\Themes;

use Flex\Themes\Exception\InvalidThemeReleaseManifest;
use Flex\Updates\Remote\UpdateChannel;

final readonly class ThemeReleaseManifest
{
    public function __construct(
        public int $schema,
        public string $package,
        public string $version,
        public UpdateChannel $channel,
        public string $downloadUrl,
        public string $checksum,
        public int $size,
        public string $minimumPhp,
        public string $compatibleFrom,
        public string $publishedAt,
        public string $releaseNotes,
        public ?string $signature = null,
        public ?string $signatureAlgorithm = null,
        public ?string $keyId = null,
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $schema = $data['schema'] ?? null;
        $package = $data['package'] ?? null;
        $version = $data['version'] ?? null;
        $channel = $data['channel'] ?? null;
        $downloadUrl = $data['download_url'] ?? null;
        $checksum = $data['checksum'] ?? null;
        $size = $data['size'] ?? null;
        $minimumPhp = $data['minimum_php'] ?? null;
        $compatibleFrom = $data['compatible_from'] ?? null;
        $publishedAt = $data['published_at'] ?? null;
        $releaseNotes = $data['release_notes'] ?? '';
        if ($schema !== 1 || !is_string($package) || preg_match('/^[a-z0-9][a-z0-9._-]*$/', $package) !== 1) {
            throw new InvalidThemeReleaseManifest('Невалидна схема или ID на темата в release manifest-а.');
        }
        if (!is_string($version) || preg_match('/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/', $version) !== 1) {
            throw new InvalidThemeReleaseManifest('Версията на темата трябва да използва semantic versioning.');
        }
        if (!is_string($channel) || UpdateChannel::tryFrom($channel) === null) {
            throw new InvalidThemeReleaseManifest('Каналът на темата е невалиден.');
        }
        if (!is_string($downloadUrl) || filter_var($downloadUrl, FILTER_VALIDATE_URL) === false || !str_starts_with(strtolower($downloadUrl), 'https://')) {
            throw new InvalidThemeReleaseManifest('URL адресът за сваляне трябва да бъде HTTPS.');
        }
        if (!is_string($checksum) || preg_match('/^[a-f0-9]{64}$/', $checksum) !== 1 || !is_int($size) || $size < 1) {
            throw new InvalidThemeReleaseManifest('Release checksum или размерът е невалиден.');
        }
        if (!is_string($minimumPhp) || !is_string($compatibleFrom) || !is_string($publishedAt) || !is_string($releaseNotes)) {
            throw new InvalidThemeReleaseManifest('Липсват съвместимост или release бележки.');
        }
        try {
            new \DateTimeImmutable($publishedAt);
            (new \Composer\Semver\VersionParser())->parseConstraints($minimumPhp);
            (new \Composer\Semver\VersionParser())->parseConstraints($compatibleFrom);
        } catch (\Throwable $exception) {
            throw new InvalidThemeReleaseManifest('Release manifest-ът съдържа невалидна дата или constraint.', 0, $exception);
        }

        return new self($schema, $package, $version, UpdateChannel::from($channel), $downloadUrl, $checksum, $size, $minimumPhp, $compatibleFrom, $publishedAt, $releaseNotes, is_string($data['signature'] ?? null) ? $data['signature'] : null, is_string($data['signature_algorithm'] ?? null) ? $data['signature_algorithm'] : null, is_string($data['key_id'] ?? null) ? $data['key_id'] : null);
    }

    /** @return array<string, mixed> */
    public function signingData(): array
    {
        return [
            'schema' => $this->schema,
            'package' => $this->package,
            'type' => 'theme',
            'version' => $this->version,
            'channel' => $this->channel->value,
            'download_url' => $this->downloadUrl,
            'checksum' => $this->checksum,
            'size' => $this->size,
            'minimum_php' => $this->minimumPhp,
            'compatible_from' => $this->compatibleFrom,
            'published_at' => $this->publishedAt,
            'release_notes' => $this->releaseNotes,
            ...($this->signatureAlgorithm !== null ? ['signature_algorithm' => $this->signatureAlgorithm] : []),
            ...($this->keyId !== null ? ['key_id' => $this->keyId] : []),
        ];
    }
}
