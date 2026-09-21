<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateCoreInstallationTables extends AbstractMigration
{
    public function up(): void
    {
        if (!$this->hasTable('users')) {
            $this->table('users', ['id' => false, 'primary_key' => ['id']])
                ->addColumn('id', 'biginteger', ['identity' => true, 'signed' => false])
                ->addColumn('name', 'string', ['limit' => 120])
                ->addColumn('email', 'string', ['limit' => 190])
                ->addColumn('password_hash', 'string', ['limit' => 255])
                ->addColumn('role', 'string', ['limit' => 50, 'default' => 'user'])
                ->addColumn('status', 'string', ['limit' => 30, 'default' => 'active'])
                ->addColumn('last_login_at', 'datetime', ['null' => true])
                ->addColumn('created_at', 'datetime')
                ->addColumn('updated_at', 'datetime')
                ->addIndex(['email'], ['unique' => true, 'name' => 'users_email_unique'])
                ->create();
        }

        if (!$this->hasTable('settings')) {
            $this->table('settings', ['id' => false, 'primary_key' => ['key']])
                ->addColumn('key', 'string', ['limit' => 190, 'null' => false])
                ->addColumn('value', 'text', ['null' => true])
                ->addColumn('type', 'string', ['limit' => 30, 'default' => 'string'])
                ->addColumn('group', 'string', ['limit' => 80, 'default' => 'general'])
                ->addColumn('autoload', 'boolean', ['default' => true])
                ->addColumn('created_at', 'datetime')
                ->addColumn('updated_at', 'datetime')
                ->addIndex(['group'], ['name' => 'settings_group_index'])
                ->create();
        }
    }

    public function down(): void
    {
        if ($this->hasTable('settings')) {
            $this->table('settings')->drop()->save();
        }
        if ($this->hasTable('users')) {
            $this->table('users')->drop()->save();
        }
    }
}
