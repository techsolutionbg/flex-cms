<?php

declare(strict_types=1);

namespace Flex\Http\Controller;

use Flex\Configuration\ProjectPaths;
use Flex\Media\{MediaException, MediaService};
use Psr\Http\Message\{ResponseFactoryInterface, ResponseInterface, ServerRequestInterface, StreamFactoryInterface};

final readonly class PublicMediaController
{
    public function __construct(private MediaService $media, private ProjectPaths $paths, private ResponseFactoryInterface $responses, private StreamFactoryInterface $streams) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments): ResponseInterface
    {
        try {
            $record = $this->media->get((int) $arguments['id']);
        } catch (MediaException) {
            return $this->responses->createResponse(404);
        }
        $thumbnail = ($arguments['variant'] ?? '') === 'thumbnail';
        if (!$thumbnail && ($arguments['variant'] ?? '') !== 'original') {
            return $this->responses->createResponse(404);
        }
        $path = $record[$thumbnail ? 'thumbnail_path' : 'path'];
        if (!is_string($path) || !is_file($this->paths->publicMedia($path))) {
            return $this->responses->createResponse(404);
        }
        $file = $this->paths->publicMedia($path);
        $modified = (int) filemtime($file);
        $etag = '"' . hash('sha256', $path . ':' . $modified . ':' . filesize($file)) . '"';
        $version = substr(hash('sha256', $path), 0, 16);
        $cache = $thumbnail && ($request->getQueryParams()['v'] ?? '') === $version
            ? 'public, max-age=31536000, immutable' : 'public, max-age=3600, must-revalidate';
        $response = $this->responses->createResponse(200)->withHeader('Cache-Control', $cache)
            ->withHeader('ETag', $etag)->withHeader('Last-Modified', gmdate('D, d M Y H:i:s', $modified) . ' GMT');
        $matches = $request->getHeaderLine('If-None-Match');
        $since = $request->getHeaderLine('If-Modified-Since');
        if (($matches !== '' && ($matches === '*' || in_array($etag, array_map(static fn(string $value): string => preg_replace('/^W\//', '', trim($value)), explode(',', $matches)), true)))
            || ($matches === '' && $since !== '' && strtotime($since) !== false && strtotime($since) >= $modified)) {
            return $response->withStatus(304);
        }
        $stream = $this->streams->createStreamFromFile($this->paths->publicMedia($path), 'r');
        $size = (int) $stream->getSize();
        $length = $size;
        $range = $request->getHeaderLine('Range');
        if ($range !== '' && $request->getHeaderLine('If-Range') === '') {
            if (preg_match('/^bytes=(\d*)-(\d*)$/D', $range, $matches) !== 1 || ($matches[1] === '' && $matches[2] === '')) {
                return $response->withStatus(416)->withHeader('Content-Range', 'bytes */' . $size);
            }
            $start = $matches[1] === '' ? max(0, $size - (int) $matches[2]) : (int) $matches[1];
            $end = $matches[1] === '' || $matches[2] === '' ? $size - 1 : min($size - 1, (int) $matches[2]);
            if ($start >= $size || $end < $start) {
                return $response->withStatus(416)->withHeader('Content-Range', 'bytes */' . $size);
            }
            $length = $end - $start + 1;
            $response = $response->withStatus(206)->withHeader('Content-Range', "bytes $start-$end/$size");
            if ($request->getMethod() !== 'HEAD') {
                $resource = fopen('php://temp/maxmemory:2097152', 'w+b');
                if ($resource === false) {
                    return $this->responses->createResponse(503);
                }
                $partial = $this->streams->createStreamFromResource($resource);
                $stream->seek($start);
                $remaining = $length;
                while ($remaining > 0 && !$stream->eof()) {
                    $chunk = $stream->read(min(8192, $remaining));
                    if ($chunk === '') {
                        break;
                    }
                    $partial->write($chunk);
                    $remaining -= strlen($chunk);
                }
                $stream->close();
                $stream = $partial;
                $stream->rewind();
            }
        }
        if ($request->getMethod() === 'HEAD') {
            $stream->close();
            $stream = $this->streams->createStream();
        }
        return $response->withBody($stream)
            ->withHeader('Content-Type', $thumbnail ? (str_ends_with($path, '.webp') ? 'image/webp' : 'image/png') : (string) $record['mime'])
            ->withHeader('Content-Length', (string) $length)
            ->withHeader('Accept-Ranges', 'bytes')
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('Content-Disposition', (isset($request->getQueryParams()['download']) ? 'attachment' : 'inline') . "; filename*=UTF-8''" . rawurlencode((string) $record['original_name']));
    }
}
