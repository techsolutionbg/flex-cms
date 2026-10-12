<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Themes\Exception\ThemeResourceException;
use Flex\Themes\ThemeResourceService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminThemeResourcesController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private ResponseFactoryInterface $responses,
        private RequestInput $input,
        private ThemeResourceService $records,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['message' => 'Достъпът е забранен.']], 403);
        }
        $resource = (string) ($arguments['resource'] ?? '');
        $id = isset($arguments['id']) ? (int) $arguments['id'] : null;
        $method = $request->getMethod();
        $path = $request->getUri()->getPath();
        try {
            if ($method === 'GET' && $id === null) {
                $view = $request->getQueryParams()['view'] ?? 'active';
                $result = ['records' => $this->records->list($resource, is_string($view) ? $view : 'active')];
                $status = 200;
            } elseif ($method === 'GET' && $id !== null) {
                $result = ['record' => $this->records->show($resource, $id)];
                $status = 200;
            } elseif ($method === 'POST' && $id === null) {
                $result = ['record' => $this->records->create($resource, $this->input->all($request))];
                $status = 201;
            } elseif (in_array($method, ['PATCH', 'PUT'], true) && $id !== null && str_ends_with($path, '/status')) {
                $statusValue = $this->input->all($request)['status'] ?? '';
                $result = ['record' => $this->records->setStatus($resource, $id, is_string($statusValue) ? $statusValue : '')];
                $status = 200;
            } elseif (in_array($method, ['PATCH', 'PUT'], true) && $id !== null) {
                $result = ['record' => $this->records->update($resource, $id, $this->input->all($request))];
                $status = 200;
            } elseif ($method === 'POST' && $id !== null && str_ends_with($path, '/restore')) {
                $this->records->restore($resource, $id);
                $result = ['restored' => true];
                $status = 200;
            } elseif ($method === 'DELETE' && $id !== null && str_ends_with($path, '/force')) {
                $this->records->forceDelete($resource, $id);
                $result = ['deleted' => true];
                $status = 200;
            } elseif ($method === 'DELETE' && $id !== null) {
                $this->records->trash($resource, $id);
                $result = ['deleted' => true];
                $status = 200;
            } else {
                throw new ThemeResourceException('Неподдържана операция.', 405);
            }

            return $this->responses->json($result, $status, ['Cache-Control' => 'no-store']);
        } catch (ThemeResourceException $error) {
            return $this->responses->json(
                ['error' => ['message' => $error->getMessage(), ...($error->fields !== [] ? ['fields' => $error->fields] : [])]],
                $error->getCode() >= 400 ? $error->getCode() : 422,
                ['Cache-Control' => 'no-store'],
            );
        }
    }
}
