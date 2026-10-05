<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Themes\ThemeManager;
use Flex\Menus\MenuService;
use Flex\Menus\MenuException;
use Flex\Pages\PageRepository;
use Flex\Http\RequestInput;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminMenusDataController
{
    public function __construct(private AuthenticationInterface $authentication, private ThemeManager $themes, private ResponseFactoryInterface $responses, private MenuService $menus, private PageRepository $pages, private RequestInput $input) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['message' => 'Достъпът е забранен.']], 403);
        }
        $capabilities = $this->themes->capabilities();
        if (!$capabilities['supports']['menus']) {
            return $this->responses->json(['error' => ['message' => 'Активната тема не поддържа управление на менюта.']], 403, ['Cache-Control' => 'no-store']);
        }
        try {
            $method = $request->getMethod();
            $id = isset($arguments['id']) ? filter_var($arguments['id'], FILTER_VALIDATE_INT) : null;
            if ($id !== null && (!is_int($id) || $id < 1)) {
                throw new MenuException('Невалиден идентификатор.', 422);
            }
            $input = $method === 'GET' ? [] : $this->input->all($request);
            if ($request->getUri()->getPath() === '/api/admin/menu-assignments') {
                $result = $this->menus->assign($input);
            } elseif ($method === 'GET' && $id === null) {
                $view = $request->getQueryParams()['view'] ?? 'active';
                if (!is_string($view)) {
                    throw new MenuException('Невалиден изглед на менюта.', 422);
                }
                $result = $this->menus->index($view);
                $result['pages'] = $this->pages->all()->map(fn($page) => ['id' => (int) $page->getKey(), 'title' => (string) $page->getAttribute('title'), 'status' => (string) $page->getAttribute('status')])->values()->all();
            } elseif ($method === 'GET') {
                $result = ['menu' => $this->menus->get($id)];
            } elseif ($method === 'POST' && $id !== null) {
                $this->menus->restore($id, $input['version'] ?? null);
                $result = ['restored' => true];
            } elseif ($method === 'POST' || $method === 'PUT') {
                $result = array_key_exists('placement', $input)
                    ? $this->menus->saveWithPlacement($input, $id)
                    : ['menu' => $this->menus->save($input, $id)];
            } elseif ($method === 'DELETE' && $id !== null) {
                if (str_ends_with($request->getUri()->getPath(), '/force')) {
                    $this->menus->delete($id, $input['version'] ?? null);
                    $result = ['deleted' => true];
                } else {
                    $this->menus->trash($id, $input['version'] ?? null);
                    $result = ['trashed' => true];
                }
            } else {
                throw new MenuException('Неподдържана операция.', 405);
            }
            return $this->responses->json($result, $method === 'POST' ? 201 : 200, ['Cache-Control' => 'no-store']);
        } catch (MenuException $exception) {
            return $this->responses->json(['error' => ['message' => $exception->getMessage()]], $exception->getCode(), ['Cache-Control' => 'no-store']);
        }
    }
}
