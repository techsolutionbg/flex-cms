<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddDeletedAtToMenus extends AbstractMigration
{
    public function change(): void
    {
        $this->table('menus')->addColumn('deleted_at', 'datetime', ['null' => true])->addIndex(['deleted_at'])->update();
    }
}
