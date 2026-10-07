<?php

declare(strict_types=1);

namespace Flex\Tests\Media;

use Flex\Configuration\{ConfigurationRepository, ProjectPaths};
use Flex\Database\DatabaseManager;
use Flex\Media\{MediaException, MediaService};
use Illuminate\Database\Schema\Blueprint;
use Nyholm\Psr7\{Stream, UploadedFile};
use PHPUnit\Framework\TestCase;

final class MediaServiceTest extends TestCase
{
    private DatabaseManager $database;
    private MediaService $media;
    private string $directory;
    private ConfigurationRepository $config;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-media-' . bin2hex(random_bytes(5));
        $config = new ConfigurationRepository(['paths' => ['public_media' => 'media'], 'filesystems' => ['media' => ['max_upload_mb' => 1]], 'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]]]);
        $this->config = $config;
        $this->database = new DatabaseManager($config);
        $this->database->schema()->create('users', static function (Blueprint $table): void {
            $table->increments('id');
            $table->string('email');
        });
        $this->database->schema()->create('media', static function (Blueprint $table): void {
            $table->increments('id');
            foreach (['original_name', 'path', 'mime', 'title', 'alt', 'caption', 'description'] as $name) {
                $table->text($name);
            }
            $table->text('thumbnail_path')->nullable();
            foreach (['width', 'height'] as $name) {
                $table->integer($name)->nullable();
            }
            $table->integer('size');
            $table->integer('uploaded_by');
            $table->softDeletes();
            $table->timestamps();
        });
        $this->database->schema()->create('pages', static function (Blueprint $table): void {
            $table->increments('id');
            $table->text('title');
            $table->text('content');
            $table->integer('featured_media_id')->nullable();
            $table->string('slug')->nullable();
            $table->string('status')->nullable();
            $table->integer('author_id')->nullable();
            $table->integer('parent_id')->nullable();
            $table->text('settings')->nullable();
            $table->text('blocks')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
        $this->media = new MediaService($this->database, new ProjectPaths($this->directory, $config), $config);
    }

    protected function tearDown(): void
    {
        $this->database->disconnect();
        if (!is_dir($this->directory)) {
            return;
        }
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) {
            $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }
        rmdir($this->directory);
    }

    private function image(int $width = 800, int $height = 600): UploadedFile
    {
        if ($width * $height > 16000000) {
            // Build a valid large PNG row by row without decoding a full bitmap in the test process.
            $chunk = static fn(string $type, string $data): string => pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
            $compression = deflate_init(ZLIB_ENCODING_DEFLATE);
            $compressed = '';
            $row = "\0" . str_repeat("\0", $width * 3);
            for ($y = 0; $y < $height; $y++) {
                $compressed .= deflate_add($compression, $row, $y === $height - 1 ? ZLIB_FINISH : ZLIB_NO_FLUSH);
            }
            $bytes = "\x89PNG\r\n\x1a\n" . $chunk('IHDR', pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0)) . $chunk('IDAT', $compressed) . $chunk('IEND', '');
            return new UploadedFile(Stream::create($bytes), strlen($bytes), UPLOAD_ERR_OK, 'large.png', 'image/png');
        }
        $image = imagecreatetruecolor($width, $height);
        ob_start();
        imagepng($image);
        $bytes = (string) ob_get_clean();
        imagedestroy($image);
        return new UploadedFile(Stream::create($bytes), strlen($bytes), UPLOAD_ERR_OK, '../снимка.php', 'application/x-php');
    }

    public function testSettingsControlThumbnailSizeAndRejectDisabledCategories(): void
    {
        $this->database->schema()->create('settings', static function (Blueprint $table): void {
            $table->string('key')->primary(); $table->text('value'); $table->string('type'); $table->string('group'); $table->boolean('autoload'); $table->timestamps();
        });
        $settings = new \Flex\Settings\SectionSettings($this->database, $this->config);
        $values = array_replace($settings->all('media'), ['thumbnail_edge' => '200']);
        $settings->save('media', $values);
        $media = new MediaService($this->database, new ProjectPaths($this->directory, $this->config), $this->config, $settings);
        $record = $media->upload($this->image(), 7);
        $preview = getimagesize($this->directory . '/media/' . $record['thumbnail_path']);
        self::assertSame([200, 150], array_slice($preview, 0, 2));
        $settings->save('media', array_replace($values, ['generate_thumbnails' => '0']));
        self::assertNull($media->upload($this->image(), 7)['thumbnail_path']);
        $settings->save('media', array_replace($values, ['allow_images' => '0']));
        try { $media->upload($this->image(), 7); self::fail('Disabled image category accepted'); }
        catch (MediaException $error) { self::assertSame(422, $error->getCode()); }
        self::assertSame(2, $this->database->connection()->table('media')->count());
        foreach (['max_upload_mb' => '0', 'thumbnail_edge' => '1201', 'allow_audio' => 'yes'] as $key => $value) {
            try { $settings->save('media', array_replace($values, [$key => $value])); self::fail('Invalid media setting accepted'); }
            catch (\InvalidArgumentException $error) { self::assertSame(422, $error->getCode()); }
        }
        try { $settings->save('media', array_replace($values, ['allow_images' => '0', 'allow_documents' => '0', 'allow_audio' => '0', 'allow_video' => '0'])); self::fail('All categories disabled'); }
        catch (\InvalidArgumentException $error) { self::assertSame(422, $error->getCode()); }
        self::assertSame(1048576, $media->maxBytes());
    }

    public function testResolutionSettingAcceptsLargeOriginalAndRejectsAboveConfiguredLimit(): void
    {
        $this->database->schema()->create('settings', static function (Blueprint $table): void {
            $table->string('key')->primary(); $table->text('value'); $table->string('type'); $table->string('group'); $table->boolean('autoload'); $table->timestamps();
        });
        $settings = new \Flex\Settings\SectionSettings($this->database, $this->config);
        $values = $settings->all('media');
        self::assertSame('48', $values['max_image_megapixels']);
        $media = new MediaService($this->database, new ProjectPaths($this->directory, $this->config), $this->config, $settings);
        $settings->save('media', array_replace($values, ['max_image_megapixels' => '48']));
        $record = $media->upload($this->image(6000, 6000), 7);
        self::assertSame(6000, $record['width']);
        self::assertNull($record['thumbnail_path']);
        self::assertFileExists($this->directory . '/media/' . $record['path']);
        $settings->save('media', array_replace($values, ['max_image_megapixels' => '16']));
        self::assertSame(16, $media->maxImageMegapixels());
        try {
            $media->upload($this->image(5000, 4000), 7);
            self::fail('Accepted an image above the configured resolution');
        } catch (MediaException $error) {
            self::assertSame(422, $error->getCode());
            self::assertStringContainsString('16 мегапиксела', $error->getMessage());
            self::assertStringContainsString('5000 × 4000', $error->getMessage());
        }
        foreach (['0', '101', '1.5', '-1'] as $invalid) {
            try { $settings->save('media', array_replace($values, ['max_image_megapixels' => $invalid])); self::fail('Accepted invalid resolution'); }
            catch (\InvalidArgumentException $error) { self::assertSame(422, $error->getCode()); }
        }
        self::assertCount(1, $media->index('active'));
        self::assertSame([], glob($this->directory . '/media/.upload-*'));
    }

    public function testUploadUsesContentTypeAndMakesThumbnailWithoutChangingOriginal(): void
    {
        $record = $this->media->upload($this->image(), 7);
        self::assertSame('image/png', $record['mime']);
        self::assertSame('снимка.php', $record['original_name']);
        self::assertSame(800, $record['width']);
        self::assertStringEndsWith('.png', $record['path']);
        self::assertFileExists($this->directory . '/media/' . $record['path']);
        $preview = getimagesize($this->directory . '/media/' . $record['thumbnail_path']);
        self::assertSame([400, 300], array_slice($preview, 0, 2));
        self::assertSame('/media-files/1/original', $record['url']);
    }

    public function testOptimizedPreviewsAreRegeneratedWithoutChangingOriginal(): void
    {
        $record = $this->media->upload($this->image(), 1);
        $file = $this->directory . '/media/' . $record['path'];
        $hash = hash_file('sha256', $file);
        $old = $this->directory . '/media/' . $record['thumbnail_path'];
        $results = iterator_to_array($this->media->regenerateThumbnails(true));
        self::assertSame('generated', $results[0]['status']);
        self::assertSame($hash, hash_file('sha256', $file));
        self::assertFileDoesNotExist($old);
        self::assertNotSame($record['thumbnail_url'], $this->media->get(1)['thumbnail_url']);
        self::assertSame('skipped', iterator_to_array($this->media->regenerateThumbnails())[0]['status']);
        $factory = new \Nyholm\Psr7\Factory\Psr17Factory();
        $controller = new \Flex\Http\Controller\PublicMediaController($this->media, new ProjectPaths($this->directory, $this->config), $factory, $factory);
        $record = $this->media->get(1);
        parse_str((string) parse_url($record['thumbnail_url'], PHP_URL_QUERY), $query);
        $request = (new \Nyholm\Psr7\ServerRequest('GET', $record['thumbnail_url']))->withQueryParams($query);
        $response = $controller($request, ['id' => '1', 'variant' => 'thumbnail']);
        self::assertSame(function_exists('imagewebp') ? 'image/webp' : 'image/png', $response->getHeaderLine('Content-Type'));
        self::assertStringContainsString('immutable', $response->getHeaderLine('Cache-Control'));
        $cached = $controller($request->withHeader('If-None-Match', $response->getHeaderLine('ETag')), ['id' => '1', 'variant' => 'thumbnail']);
        self::assertSame(304, $cached->getStatusCode());
        self::assertSame('', (string) $cached->getBody());
        self::assertSame(304, $controller($request->withHeader('If-Modified-Since', $response->getHeaderLine('Last-Modified')), ['id' => '1', 'variant' => 'thumbnail'])->getStatusCode());
        self::assertSame(200, $controller($request->withHeader('If-None-Match', '"different"')->withHeader('If-Modified-Since', $response->getHeaderLine('Last-Modified')), ['id' => '1', 'variant' => 'thumbnail'])->getStatusCode());
    }

    public function testThumbnailBatchContinuesAfterMissingOriginalAndResumesById(): void
    {
        $first = $this->media->upload($this->image(), 1);
        $second = $this->media->upload($this->image(), 1);
        unlink($this->directory . '/media/' . $first['path']);
        $results = iterator_to_array($this->media->regenerateThumbnails(true, 0, 2));
        self::assertSame(['failed', 'generated'], array_column($results, 'status'));
        self::assertFileExists($this->directory . '/media/' . $first['thumbnail_path']);
        self::assertSame([], iterator_to_array($this->media->regenerateThumbnails(true, $second['id'], 2)));
    }

    public function testDetailsIncludeUploaderEmailAndHandleMissingUser(): void
    {
        $this->database->connection()->table('users')->insert(['id' => 7, 'email' => 'uploader@example.com']);
        $record = $this->media->upload($this->image(), 7);
        self::assertSame(['id' => 7, 'email' => 'uploader@example.com'], $this->media->get($record['id'])['uploader']);
        $this->database->connection()->table('users')->where('id', 7)->delete();
        self::assertNull($this->media->get($record['id'])['uploader']);
    }

    public function testScriptDisguisedAsImageIsRejectedAndLeavesNoFiles(): void
    {
        $bytes = '<?php echo "unsafe";';
        try {
            $this->media->upload(new UploadedFile(Stream::create($bytes), strlen($bytes), UPLOAD_ERR_OK, 'photo.png', 'image/png'), 1);
            self::fail('Accepted script');
        } catch (MediaException $error) {
            self::assertSame(422, $error->getCode());
        }
        self::assertSame([], glob($this->directory . '/media/.upload-*'));
        self::assertSame([], $this->media->index('active'));
    }

    public function testTrashPreservesPublicFileAndRestoreKeepsMetadata(): void
    {
        $record = $this->media->upload($this->image(), 1);
        $this->media->update($record['id'], ['title' => 'Гора', 'alt' => 'Дървета', 'caption' => '', 'description' => 'Описание']);
        $this->media->trash($record['id']);
        self::assertSame([], $this->media->index('active'));
        self::assertCount(1, $this->media->index('trash'));
        self::assertFileExists($this->directory . '/media/' . $record['path']);
        $this->media->trash($record['id'], true);
        self::assertSame('Дървета', $this->media->get($record['id'])['alt']);
    }

    public function testUsedFileCannotBePermanentlyDeleted(): void
    {
        $record = $this->media->upload($this->image(), 1);
        $this->database->connection()->table('pages')->insert(['title' => 'Начало', 'content' => '<img src="' . $record['url'] . '">']);
        $this->media->trash($record['id']);
        try {
            $this->media->delete($record['id']);
            self::fail('Deleted used image');
        } catch (MediaException $error) {
            self::assertSame(409, $error->getCode());
        }
        $this->database->connection()->table('pages')->delete();
        $this->media->delete($record['id']);
        self::assertFileDoesNotExist($this->directory . '/media/' . $record['path']);
        self::assertSame([], $this->media->index('trash'));
    }

    public function testRealFileSizeIsCheckedEvenWhenClientReportsSmallerSize(): void
    {
        $this->expectException(MediaException::class);
        $this->media->upload(new UploadedFile(Stream::create(str_repeat('x', 1048577)), 1, UPLOAD_ERR_OK, 'large.pdf', 'application/pdf'), 1);
    }

    public function testPublicDeliverySupportsRangesAndKeepsTrashedFilesAvailable(): void
    {
        $record = $this->media->upload($this->image(), 1);
        $this->media->trash($record['id']);
        $factory = new \Nyholm\Psr7\Factory\Psr17Factory();
        $config = new ConfigurationRepository(['paths' => ['public_media' => 'media']]);
        $controller = new \Flex\Http\Controller\PublicMediaController($this->media, new ProjectPaths($this->directory, $config), $factory, $factory);
        $request = new \Nyholm\Psr7\ServerRequest('GET', '/media-files/1/original', ['Range' => 'bytes=0-7']);
        $response = $controller($request, ['id' => '1', 'variant' => 'original']);
        self::assertSame(206, $response->getStatusCode());
        self::assertSame("\x89PNG\r\n\x1a\n", (string) $response->getBody());
        self::assertSame('8', $response->getHeaderLine('Content-Length'));
        self::assertSame('nosniff', $response->getHeaderLine('X-Content-Type-Options'));
        self::assertSame(416, $controller($request->withHeader('Range', 'bytes=99999999-'), ['id' => '1', 'variant' => 'original'])->getStatusCode());
        $head = $controller($request->withMethod('HEAD'), ['id' => '1', 'variant' => 'original']);
        self::assertSame('', (string) $head->getBody());
    }

    public function testFeaturedImageIsSavedAndPreventsDeletionUntilDetached(): void
    {
        $record = $this->media->upload($this->image(), 1);
        $pages = new \Flex\Pages\PageService(new \Flex\Pages\PageRepository(), $this->createStub(\Flex\Extension\V1\ExtensionApiInterface::class), media: $this->media);
        $attributes = ['title' => 'Страница', 'slug' => 'page', 'content' => '', 'featured_media_id' => $record['id']];
        $page = $pages->create($attributes, 1);
        self::assertSame($record['id'], $page->toPublicArray()['featured_media_id']);
        self::assertSame((int) $page->getKey(), $this->media->usage($record['id'])[0]['id']);
        $this->media->trash($record['id']);
        // Keeping an already attached trashed image does not break editing the page.
        $pages->update((int) $page->getKey(), $attributes);
        try {
            $this->media->delete($record['id']);
            self::fail('Deleted featured image');
        } catch (MediaException $error) {
            self::assertSame(409, $error->getCode());
        }
        $pages->update((int) $page->getKey(), [...$attributes, 'featured_media_id' => null]);
        $this->media->delete($record['id']);
        self::assertSame([], $this->media->index('trash'));
    }

    public function testMissingFeaturedImageIsRejected(): void
    {
        $pages = new \Flex\Pages\PageService(new \Flex\Pages\PageRepository(), $this->createStub(\Flex\Extension\V1\ExtensionApiInterface::class), media: $this->media);
        $this->expectException(\Flex\Pages\Exception\PageValidationFailed::class);
        $pages->create(['title' => 'Страница', 'slug' => 'page', 'featured_media_id' => 999], 1);
    }

    public function testMediaPermissionsAreEnforcedPerActionByController(): void
    {
        $config = new ConfigurationRepository(['media' => ['permissions' => ['view' => ['editor'], 'upload' => [], 'edit' => [], 'delete' => []]]]);
        $permissions = new \Flex\Media\MediaPermissions($config);
        $user = new \Flex\Auth\AuthenticatedUser(7, 'Editor', 'editor@example.invalid', 'editor', 'active');
        self::assertSame(['view' => true, 'upload' => false, 'edit' => false, 'delete' => false], $permissions->forUser($user));
        $auth = $this->createStub(\Flex\Contracts\Auth\AuthenticationInterface::class);
        $auth->method('user')->willReturn($user);
        $controller = new \Flex\Http\Controller\Admin\AdminMediaController($auth, new \Flex\Http\ResponseFactory(new \Nyholm\Psr7\Factory\Psr17Factory()), new \Flex\Http\RequestInput(), $this->media, $permissions);
        self::assertSame(200, $controller(new \Nyholm\Psr7\ServerRequest('GET', '/api/admin/media'))->getStatusCode());
        self::assertSame(403, $controller(new \Nyholm\Psr7\ServerRequest('POST', '/api/admin/media'))->getStatusCode());
        self::assertSame(403, $controller(new \Nyholm\Psr7\ServerRequest('PUT', '/api/admin/media/1'), ['id' => '1'])->getStatusCode());
        self::assertSame(403, $controller(new \Nyholm\Psr7\ServerRequest('DELETE', '/api/admin/media/1'), ['id' => '1'])->getStatusCode());
        self::assertSame(['view' => false, 'upload' => false, 'edit' => false, 'delete' => false], $permissions->forUser(null));
    }
}
