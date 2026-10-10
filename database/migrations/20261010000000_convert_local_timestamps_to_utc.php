<?php

declare(strict_types=1);

use Flex\Database\LegacyTimestampConverter;
use Phinx\Migration\AbstractMigration;

final class ConvertLocalTimestampsToUtc extends AbstractMigration
{
    public function up(): void
    {
        $connection = $this->getAdapter()->getConnection();
        if (!$connection instanceof PDO) {
            return;
        }
        // Errors must stop the migration, whatever mode the adapter set.
        $connection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        (new LegacyTimestampConverter($connection))->convert(LegacyTimestampConverter::sourceZone());
    }

    public function down(): void
    {
        // Converting back would require the original zone; restore the pre-update backup instead.
    }
}
