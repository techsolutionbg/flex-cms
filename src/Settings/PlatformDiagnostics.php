<?php
declare(strict_types=1);
namespace Flex\Settings;

use Flex\Configuration\ProjectPaths;
use Flex\Database\DatabaseManager;
use Flex\Updates\Platform\PlatformVersionRegistry;

final readonly class PlatformDiagnostics
{
    public function __construct(private DatabaseManager $database, private ProjectPaths $paths, private PlatformVersionRegistry $versions) {}
    /** @return array<string, string> */
    public function check(): array
    {
        try { $this->database->connection()->select('SELECT 1'); $database = 'Достъпна'; }
        catch (\Throwable) { $database = 'Недостъпна'; }
        try {
            $platformVersion = $this->versions->current()->value;
        } catch (\Throwable) {
            $platformVersion = 'Непозната';
        }
        $results = ['Версия на платформата' => $platformVersion, 'PHP версия' => PHP_VERSION, 'База данни' => $database];
        foreach (['curl', 'openssl', 'pdo', 'mbstring', 'fileinfo', 'gd', 'zip'] as $extension) $results['PHP: ' . $extension] = extension_loaded($extension) ? 'Налично' : 'Липсва';
        foreach (['cache', 'sessions', 'logs'] as $directory) $results['Запис: ' . $directory] = is_writable($this->paths->storage($directory)) ? 'Разрешен' : 'Недостъпна директория или запис';
        $operationLog = $this->paths->storage('logs/operation-errors.jsonl');
        $results['Дневник на операционни грешки'] = is_writable(dirname($operationLog)) ? (is_file($operationLog) ? 'Активен' : 'Готов за запис') : 'Недостъпен';
        $results['Проверено на (UTC)'] = gmdate('Y-m-d H:i:s');
        return $results;
    }
}
