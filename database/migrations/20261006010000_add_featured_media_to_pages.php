<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddFeaturedMediaToPages extends AbstractMigration
{
    public function change(): void
    {
        $this->table('pages')->addColumn('featured_media_id', 'integer', ['signed' => false, 'null' => true])
            ->addForeignKey('featured_media_id', 'media', 'id', ['delete' => 'RESTRICT'])->update();
    }
}
