<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddPasswordRecovery extends AbstractMigration
{
    public function up(): void
    {
        if (!$this->table('users')->hasColumn('auth_version')) $this->table('users')->addColumn('auth_version', 'integer', ['default' => 0, 'signed' => false])->update();
        if (!$this->hasTable('password_reset_requests')) $this->table('password_reset_requests')
            ->addColumn('user_id', 'biginteger', ['signed' => false])
            ->addColumn('code_hash', 'string', ['limit' => 64, 'null' => false])
            ->addColumn('expires_at', 'datetime')
            ->addColumn('attempts', 'integer', ['default' => 0])
            ->addColumn('grant_hash', 'string', ['limit' => 64, 'null' => true])
            ->addColumn('grant_expires_at', 'datetime', ['null' => true])
            ->addColumn('used_at', 'datetime', ['null' => true])
            ->addColumn('created_at', 'datetime')
            ->addIndex(['user_id'])->create();
        if (!$this->hasTable('password_reset_limits')) $this->table('password_reset_limits', ['id' => false, 'primary_key' => ['key']])
            ->addColumn('key', 'string', ['limit' => 64, 'null' => false])
            ->addColumn('attempts', 'integer', ['default' => 0])
            ->addColumn('window_started_at', 'integer', ['limit' => 8])
            ->addColumn('last_attempt_at', 'integer', ['limit' => 8])->create();
    }

    public function down(): void
    {
        foreach (['password_reset_requests', 'password_reset_limits'] as $table) {
            if ($this->hasTable($table)) $this->table($table)->drop()->save();
        }
        if ($this->table('users')->hasColumn('auth_version')) $this->table('users')->removeColumn('auth_version')->update();
    }
}
