<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

interface AdminExtensionRegistrarInterface
{
    public function sidebarItem(string $id, string $label, string $href, int $priority = 50): void;

    /** @param 'notice'|'card'|'link' $kind */
    public function slot(string $name, string $kind, string $title, string $text = '', ?string $href = null, int $priority = 50): void;
}
