<?php

declare(strict_types=1);

namespace Flex\Media;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;

final readonly class MediaPermissions
{
    public function __construct(private ConfigRepositoryInterface $config) {}

    /** @return array{view: bool, upload: bool, edit: bool, delete: bool} */
    public function forUser(?AuthenticatedUser $user): array
    {
        $result = ['view' => false, 'upload' => false, 'edit' => false, 'delete' => false];
        if ($user === null || $user->status !== 'active') {
            return $result;
        }
        foreach ($result as $action => $_) {
            $result[$action] = in_array($user->role, $this->config->array('media.permissions.' . $action, ['super_admin']), true);
        }
        return $result;
    }
}
