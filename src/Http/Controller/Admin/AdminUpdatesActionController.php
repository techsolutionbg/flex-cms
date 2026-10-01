<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\ApiError;
use Flex\Http\RequestInput;
use Flex\Updates\Jobs\UpdateJobStore;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminUpdatesActionController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private RequestInput $input,
        private UpdateJobStore $jobs,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(ApiError::payload(403, 'super_admin_required', 'Необходим е достъп на супер администратор.'), 403);
        }

        try {
            $input = $this->input->all($request);
            $action = $input['action'] ?? null;
            if (!is_string($action) || !in_array($action, ['update_remote', 'rollback'], true)) {
                return $this->responses->json(ApiError::payload(422, 'validation_failed', 'Необходимо е валидно действие за обновяване.'), 422);
            }

            if ($action === 'update_remote') {
                $job = $this->jobs->queuePlatformUpdate();
                return $this->responses->json([
                    'message' => sprintf('Обновяването е поставено в опашката (%s) и ще бъде обработено от updater процеса.', $job->id),
                    'job_id' => $job->id,
                    'queued' => true,
                ], 202);
            }

            $id = $input['id'] ?? null;
            if (!is_string($id) || $id === '') {
                return $this->responses->json(ApiError::payload(422, 'validation_failed', 'Необходимо е валидно ID на обновяването.'), 422);
            }
            $job = $this->jobs->queuePlatformRollback($id);
            return $this->responses->json([
                'message' => sprintf('Възстановяването е поставено в опашката (%s) и ще бъде обработено от updater процеса.', $job->id),
                'job_id' => $job->id,
                'queued' => true,
            ], 202);
        } catch (\Throwable $exception) {
            return $this->responses->json(ApiError::payload(422, 'update_action_failed', $exception->getMessage()), 422);
        }
    }
}
