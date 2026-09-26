<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Composer\Semver\VersionParser;
use Flex\Updates\Exception\InvalidRemoteReleaseManifest;
use Flex\Updates\Platform\PlatformVersion;

/**
 * The signed catalog entry used by updates.flex-cms.com.
 *
 * It describes a release, not the manifest embedded in the ZIP package. The
 * embedded package manifest remains the source of truth for the files that
 * will be installed and is validated separately by the package inspector.
 */
final readonly class RemoteReleaseManifest
{
    /** @param array<string, mixed> $data */
    public function __construct(
        public int $schema,
        public string $package,
        public string $type,
        public PlatformVersion $version,
        public UpdateChannel $channel,
        public string $downloadUrl,
        public string $checksum,
        public int $size,
        public string $minimumPhp,
        public string $compatibleFrom,
        public string $publishedAt,
        public string $releaseNotes,
        public ?string $signature,
        public ?string $signatureAlgorithm,
        public ?string $keyId,
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $schema = $data['schema'] ?? null;
        $package = $data['package'] ?? null;
        $type = $data['type'] ?? null;
        $version = $data['version'] ?? null;
        $channel = $data['channel'] ?? null;
        $downloadUrl = $data['download_url'] ?? null;
        $checksum = $data['checksum'] ?? null;
        $size = $data['size'] ?? null;
        $minimumPhp = $data['minimum_php'] ?? null;
        $compatibleFrom = $data['compatible_from'] ?? null;
        $publishedAt = $data['published_at'] ?? null;
        $releaseNotes = $data['release_notes'] ?? '';
        $signature = $data['signature'] ?? null;
        $signatureAlgorithm = $data['signature_algorithm'] ?? null;
        $keyId = $data['key_id'] ?? null;

        if ($schema !== 1) {
            throw new InvalidRemoteReleaseManifest('Unsupported remote release manifest schema.');
        }
        if (!is_string($package) || !preg_match('/^(?:flex-cms|[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*)$/', $package)) {
            throw new InvalidRemoteReleaseManifest('The release package must be flex-cms or a vendor/name plugin ID.');
        }
        if (!is_string($type) || !in_array($type, ['platform', 'plugin'], true)) {
            throw new InvalidRemoteReleaseManifest('The release type must be platform or plugin.');
        }
        if ($type === 'platform' && $package !== 'flex-cms') {
            throw new InvalidRemoteReleaseManifest('Platform releases must use the flex-cms package ID.');
        }
        if ($type === 'plugin' && $package === 'flex-cms') {
            throw new InvalidRemoteReleaseManifest('Plugin releases must use a vendor/name package ID.');
        }
        if (!is_string($version) || !preg_match('/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/', $version)) {
            throw new InvalidRemoteReleaseManifest('The release version must use semantic versioning.');
        }
        if (!is_string($channel) || UpdateChannel::tryFrom($channel) === null) {
            throw new InvalidRemoteReleaseManifest('The release channel is invalid.');
        }
        if (!is_string($downloadUrl) || filter_var($downloadUrl, FILTER_VALIDATE_URL) === false || !str_starts_with(strtolower($downloadUrl), 'https://')) {
            throw new InvalidRemoteReleaseManifest('The release download URL must be an HTTPS URL.');
        }
        if (!is_string($checksum) || preg_match('/^[a-f0-9]{64}$/', $checksum) !== 1) {
            throw new InvalidRemoteReleaseManifest('The release checksum must be a SHA-256 hexadecimal value.');
        }
        if (!is_int($size) || $size < 1) {
            throw new InvalidRemoteReleaseManifest('The release size must be a positive integer.');
        }
        if (!is_string($minimumPhp) || !is_string($compatibleFrom)) {
            throw new InvalidRemoteReleaseManifest('The release compatibility constraints are required.');
        }
        try {
            $parser = new VersionParser();
            $parser->parseConstraints($minimumPhp);
            $parser->parseConstraints($compatibleFrom);
        } catch (\UnexpectedValueException $exception) {
            throw new InvalidRemoteReleaseManifest('The release contains an invalid compatibility constraint.', 0, $exception);
        }
        if (!is_string($publishedAt) || self::date($publishedAt) === null) {
            throw new InvalidRemoteReleaseManifest('The release published_at value must be an RFC 3339 date.');
        }
        if (!is_string($releaseNotes)) {
            throw new InvalidRemoteReleaseManifest('The release notes must be a string.');
        }
        if (($signature !== null && !is_string($signature))
            || ($signatureAlgorithm !== null && !is_string($signatureAlgorithm))
            || ($keyId !== null && !is_string($keyId))) {
            throw new InvalidRemoteReleaseManifest('The release signature fields are invalid.');
        }

        return new self(
            schema: $schema,
            package: $package,
            type: $type,
            version: new PlatformVersion($version),
            channel: UpdateChannel::from($channel),
            downloadUrl: $downloadUrl,
            checksum: $checksum,
            size: $size,
            minimumPhp: $minimumPhp,
            compatibleFrom: $compatibleFrom,
            publishedAt: $publishedAt,
            releaseNotes: $releaseNotes,
            signature: $signature,
            signatureAlgorithm: $signatureAlgorithm,
            keyId: $keyId,
        );
    }

    /** @return array<string, mixed> */
    public function signingData(): array
    {
        return [
            'schema' => $this->schema,
            'package' => $this->package,
            'type' => $this->type,
            'version' => $this->version->value,
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

    private static function date(string $value): ?\DateTimeImmutable
    {
        try {
            $date = new \DateTimeImmutable($value);
        } catch (\Exception) {
            return null;
        }

        return $date->format(DATE_ATOM) === $value ? $date : null;
    }
}
