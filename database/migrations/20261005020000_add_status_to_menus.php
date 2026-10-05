<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddStatusToMenus extends AbstractMigration
{
    public function change(): void
    {
        $this->table('menus')->addColumn('status', 'string', ['limit' => 20, 'default' => 'active'])->update();
    }
}
