<?php

declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateExtensionDocuments extends AbstractMigration
{
    public function change(): void
    {
        if ($this->hasTable('extension_documents')) {
            return;
        }
        $this->table('extension_documents', ['id' => false, 'primary_key' => ['plugin_id', 'document_key']])
            ->addColumn('plugin_id', 'string', ['limit' => 190, 'null' => false])
            ->addColumn('document_key', 'string', ['limit' => 190, 'null' => false])
            ->addColumn('payload', 'text', ['limit' => \Phinx\Db\Adapter\MysqlAdapter::TEXT_LONG])
            ->addColumn('updated_at', 'datetime')->create();
    }
}
