<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Pages\PageRepository;
use Flex\Themes\ThemeManager;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminThemeCapabilitiesController
{
    public function __construct(private AuthenticationInterface $authentication, private ThemeManager $themes, private ResponseFactoryInterface $responses, private PageRepository $pages) {}

    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['message' => 'Достъпът е забранен.']], 403);
        }
        $capabilities = $this->themes->capabilities();
        $navigation = is_array($capabilities['admin_navigation'] ?? null) ? $capabilities['admin_navigation'] : ['groups' => [], 'sections' => [], 'items' => []];
        $items = [];
        foreach (is_array($navigation['items'] ?? null) ? $navigation['items'] : [] as $item) {
            if (!is_array($item)) {
                continue;
            }
            $page = is_string($item['page'] ?? null) ? $item['page'] : '';
            if ($page !== '') {
                $match = $this->pages->findBySlug($page);
                if ($match !== null) {
                    $item['href'] = '/pages/' . $match->getKey() . '/edit';
                }
            }
            unset($item['page']);
            if (($item['href'] ?? '') === '') {
                continue;
            }
            $items[] = $item;
        }
        $hrefs = array_column($items, 'href');
        foreach (is_array($capabilities['resources'] ?? null) ? $capabilities['resources'] : [] as $resource) {
            if (!is_array($resource) || !is_string($resource['id'] ?? null) || !is_string($resource['label'] ?? null)) {
                continue;
            }
            $href = '/theme-resources/' . $resource['id'];
            if (in_array($href, $hrefs, true)) {
                continue;
            }
            $items[] = [
                'id' => 'resource-' . $resource['id'],
                'label' => $resource['label'],
                'icon' => is_string($resource['icon'] ?? null) ? $resource['icon'] : 'folder',
                'href' => $href,
                'group' => is_string($resource['group'] ?? null) ? $resource['group'] : 'content',
                'section' => '',
                'order' => is_int($resource['order'] ?? null) ? $resource['order'] : 30,
            ];
        }
        $navigation['items'] = $items;
        $capabilities['admin_navigation'] = $navigation;

        return $this->responses->json($capabilities, 200, ['Cache-Control' => 'no-store']);
    }
}
