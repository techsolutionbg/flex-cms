<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddSettingsToPagesTable extends AbstractMigration
{
    public function up(): void
    {
        if (!$this->hasTable('pages') || $this->table('pages')->hasColumn('settings')) return;
        $this->table('pages')->addColumn('settings', 'json', ['null' => true])->update();
    }

    public function down(): void
    {
        if (!$this->hasTable('pages') || !$this->table('pages')->hasColumn('settings')) return;
        $this->table('pages')->removeColumn('settings')->update();
    }
}
