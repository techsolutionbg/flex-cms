<?php

declare(strict_types=1);

namespace Flex\Tests\Logging;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Logging\OperationErrorJournal;
use PHPUnit\Framework\TestCase;

final class OperationErrorJournalTest extends TestCase
{
    private string $root;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/flex-operation-errors-' . bin2hex(random_bytes(4));
        mkdir($this->root . '/storage/logs', 0775, true);
    }

    protected function tearDown(): void
    {
        $log = $this->root . '/storage/logs/operation-errors.jsonl';
        if (is_file($log)) {
            unlink($log);
        }
        @rmdir($this->root . '/storage/logs');
        @rmdir($this->root . '/storage');
        @rmdir($this->root);
    }

    public function testItRecordsAndListsEntries(): void
    {
        $journal = $this->journal();
        $journal->record('plugin', 'flex/demo', 'plugin.activate', 'Activation failed.');
        $entries = $journal->recent(10);
        self::assertCount(1, $entries);
        self::assertSame('plugin', $entries[0]['scope']);
        self::assertSame('flex/demo', $entries[0]['component']);
        self::assertSame('Activation failed.', $entries[0]['message']);
    }

    public function testItClearsTheLog(): void
    {
        $journal = $this->journal();
        $journal->record('platform', 'core', 'http.request', 'Server error.');
        self::assertSame(1, $journal->count());
        $journal->clear();
        self::assertSame(0, $journal->count());
    }

    public function testItReturnsRawFileContents(): void
    {
        $journal = $this->journal();
        $journal->record('plugin', 'flex/demo', 'plugin.activate', 'Activation failed.');
        $file = $journal->fileContents();
        self::assertSame('storage/logs/operation-errors.jsonl', $file['path']);
        self::assertStringContainsString('Activation failed.', $file['content']);
        self::assertFalse($file['truncated']);
    }

    private function journal(): OperationErrorJournal
    {
        $configuration = new ConfigurationRepository([
            'paths' => ['storage' => 'storage'],
            'logging' => [
                'operation_errors' => [
                    'max_entries' => 500,
                ],
            ],
        ]);
        $paths = new ProjectPaths($this->root, $configuration);

        return new OperationErrorJournal($configuration, $paths);
    }
}
