<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateMenusTables extends AbstractMigration
{
    public function change(): void
    {
        $this->table('menus', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'biginteger', ['identity' => true, 'signed' => false])
            ->addColumn('name', 'string', ['limit' => 120])
            ->addColumn('slug', 'string', ['limit' => 120])
            ->addColumn('version', 'integer', ['default' => 1, 'signed' => false])
            ->addColumn('created_at', 'datetime')->addColumn('updated_at', 'datetime')
            ->addIndex(['slug'], ['unique' => true])->create();
        $this->table('menu_items')
            ->addColumn('menu_id', 'biginteger', ['signed' => false])
            ->addColumn('item_key', 'string', ['limit' => 64])
            ->addColumn('parent_key', 'string', ['limit' => 64, 'null' => true])
            ->addColumn('position', 'integer', ['signed' => false])
            ->addColumn('label', 'string', ['limit' => 190])
            ->addColumn('type', 'string', ['limit' => 20])
            ->addColumn('page_id', 'integer', ['signed' => false, 'null' => true])
            ->addColumn('url', 'string', ['limit' => 2048, 'null' => true])
            ->addColumn('new_tab', 'boolean', ['default' => false])
            ->addIndex(['menu_id', 'item_key'], ['unique' => true])
            ->addForeignKey('menu_id', 'menus', 'id', ['delete' => 'CASCADE'])
            ->addForeignKey('page_id', 'pages', 'id', ['delete' => 'SET_NULL'])->create();
        $this->table('theme_menu_assignments')
            ->addColumn('theme_id', 'string', ['limit' => 190])
            ->addColumn('location', 'string', ['limit' => 120])
            ->addColumn('menu_id', 'biginteger', ['signed' => false])
            ->addIndex(['theme_id', 'location'], ['unique' => true])
            ->addForeignKey('menu_id', 'menus', 'id', ['delete' => 'CASCADE'])->create();
    }
}
