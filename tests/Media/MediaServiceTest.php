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

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-media-' . bin2hex(random_bytes(5));
        $config = new ConfigurationRepository(['paths' => ['public_media' => 'media'], 'filesystems' => ['media' => ['max_upload_mb' => 1]], 'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]]]);
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

    private function image(): UploadedFile
    {
        $image = imagecreatetruecolor(800, 600);
        ob_start();
        imagepng($image);
        $bytes = (string) ob_get_clean();
        imagedestroy($image);
        return new UploadedFile(Stream::create($bytes), strlen($bytes), UPLOAD_ERR_OK, '../снимка.php', 'application/x-php');
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
