<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddEmailVerificationToUsers extends AbstractMigration
{
    public function up(): void
    {
        $table = $this->table('users');
        if (!$table->hasColumn('email_verification_required')) {
            $table->addColumn('email_verification_required', 'boolean', ['default' => false]);
        }
        if (!$table->hasColumn('email_verified_at')) {
            $table->addColumn('email_verified_at', 'datetime', ['null' => true]);
        }
        $table->save();

        if (!$this->hasTable('email_verification_tokens')) {
            $this->table('email_verification_tokens', ['id' => false, 'primary_key' => ['id']])
                ->addColumn('id', 'biginteger', ['identity' => true, 'signed' => false])
                ->addColumn('user_id', 'biginteger', ['signed' => false])
                ->addColumn('token_hash', 'string', ['limit' => 64])
                ->addColumn('expires_at', 'datetime')
                ->addColumn('used_at', 'datetime', ['null' => true])
                ->addColumn('created_at', 'datetime')
                ->addIndex(['token_hash'], ['unique' => true, 'name' => 'email_verification_tokens_hash_unique'])
                ->addIndex(['user_id'], ['name' => 'email_verification_tokens_user_index'])
                ->create();
        }
    }

    public function down(): void
    {
        if ($this->hasTable('email_verification_tokens')) {
            $this->table('email_verification_tokens')->drop()->save();
        }
        if ($this->hasTable('users')) {
            $table = $this->table('users');
            if ($table->hasColumn('email_verified_at')) {
                $table->removeColumn('email_verified_at');
            }
            if ($table->hasColumn('email_verification_required')) {
                $table->removeColumn('email_verification_required');
            }
            $table->save();
        }
    }
}
