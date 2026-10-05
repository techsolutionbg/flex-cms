<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddAttributesToMenuItems extends AbstractMigration
{
    public function change(): void
    {
        $this->table('menu_items')
            ->addColumn('seo_title', 'string', ['limit' => 190, 'default' => ''])
            ->addColumn('aria_label', 'string', ['limit' => 190, 'default' => ''])
            ->addColumn('css_class', 'string', ['limit' => 190, 'default' => ''])
            ->addColumn('rel', 'string', ['limit' => 120, 'default' => ''])->update();
    }
}
