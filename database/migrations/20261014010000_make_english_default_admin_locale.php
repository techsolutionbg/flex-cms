<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class MakeEnglishDefaultAdminLocale extends AbstractMigration
{
    public function up(): void
    {
        $users = $this->table('users');
        if (!$users->hasColumn('admin_locale')) {
            return;
        }

        $users->changeColumn('admin_locale', 'string', [
            'limit' => 16,
            'default' => 'en',
        ])->save();

        // Bulgarian was the previous default, so move those implicit selections
        // to English along with the new default. Users can still choose Bulgarian.
        $this->execute("UPDATE users SET admin_locale = 'en' WHERE admin_locale = 'bg'");
    }

    public function down(): void
    {
        $users = $this->table('users');
        if (!$users->hasColumn('admin_locale')) {
            return;
        }

        $users->changeColumn('admin_locale', 'string', [
            'limit' => 16,
            'default' => 'bg',
        ])->save();
    }
}
