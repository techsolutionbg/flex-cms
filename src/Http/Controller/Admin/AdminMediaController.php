<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Media\{MediaException, MediaService};
use Psr\Http\Message\{ResponseInterface, ServerRequestInterface, UploadedFileInterface};

final readonly class AdminMediaController
{
    public function __construct(private AuthenticationInterface $auth, private ResponseFactoryInterface $responses, private RequestInput $input, private MediaService $media, private \Flex\Media\MediaPermissions $permissions) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->auth->user();
        $permissions = $this->permissions->forUser($user instanceof AuthenticatedUser ? $user : null);
        $operation = match ($request->getMethod()) {
            'GET' => 'view', 'PUT' => 'edit', 'DELETE' => 'delete', 'POST' => isset($arguments['id']) ? 'delete' : 'upload', default => 'view'
        };
        if (!$user instanceof AuthenticatedUser || !$permissions['view'] || !$permissions[$operation]) {
            return $this->responses->json(['error' => ['message' => 'Достъпът е забранен.']], 403);
        }
        try {
            $method = $request->getMethod();
            $id = isset($arguments['id']) ? filter_var($arguments['id'], FILTER_VALIDATE_INT) : null;
            if ($id !== null && (!is_int($id) || $id < 1)) {
                throw new MediaException('Невалиден идентификатор.', 422);
            }
            if ($method === 'GET') {
                $view = $request->getQueryParams()['view'] ?? 'active';
                if (!is_string($view)) {
                    throw new MediaException('Невалиден изглед.', 422);
                }
                $result = $id === null ? ['media' => $this->media->index($view), 'max_bytes' => $this->media->maxBytes(), 'permissions' => $permissions] : ['media' => $this->media->get($id), 'usage' => $this->media->usage($id), 'permissions' => $permissions];
            } elseif ($method === 'POST' && $id === null) {
                $file = $request->getUploadedFiles()['file'] ?? null;
                if (!$file instanceof UploadedFileInterface) {
                    throw new MediaException('Изберете файл за качване. Проверете лимита за размер.', 422);
                }
                $result = ['media' => $this->media->upload($file, $user->id)];
            } elseif ($method === 'PUT' && $id !== null) {
                $result = ['media' => $this->media->update($id, $this->input->all($request))];
            } elseif ($method === 'POST') {
                $this->media->trash($id, true);
                $result = ['restored' => true];
            } elseif ($method === 'DELETE') {
                if ($id === null) {
                    throw new MediaException('Невалиден идентификатор.', 422);
                }
                str_ends_with($request->getUri()->getPath(), '/force') ? $this->media->delete($id) : $this->media->trash($id);
                $result = ['deleted' => true];
            } else {
                throw new MediaException('Неподдържана операция.', 405);
            }
            return $this->responses->json($result, $method === 'POST' && $id === null ? 201 : 200, ['Cache-Control' => 'no-store']);
        } catch (MediaException $error) {
            return $this->responses->json(['error' => ['message' => $error->getMessage()]], $error->getCode(), ['Cache-Control' => 'no-store']);
        }
    }
}
