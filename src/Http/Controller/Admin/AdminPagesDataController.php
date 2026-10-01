<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Extensions\PageFieldRegistry;
use Flex\Extensions\PluginRegistry;
use Flex\Pages\PageRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminPagesDataController
{
    public function __construct(private AuthenticationInterface $authentication, private PageRepository $pages, private PageFieldRegistry $pageFields, private PluginRegistry $plugins, private ResponseFactoryInterface $responses) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['status' => 403, 'message' => 'Достъпът е забранен.']], 403);
        }

        $view = (string) ($request->getQueryParams()['view'] ?? 'active');
        $pages = $view === 'trash' ? $this->pages->trashed() : $this->pages->all();

        $fields = $this->pageFields->bootstrap();
        $pluginMetadata = [];
        foreach ($fields as $field) {
            $plugin = $this->plugins->find((string) $field['plugin']);
            $pluginMetadata[$field['plugin']] = ['name' => $plugin?->getAttribute('name') ?: $field['plugin'], 'version' => $plugin?->getAttribute('version') ?: '—'];
        }
        $fields = array_map(static fn(array $field): array => $field + ['plugin_name' => $pluginMetadata[$field['plugin']]['name'], 'plugin_version' => $pluginMetadata[$field['plugin']]['version']], $fields);
        $pageList = $pages->map(function (\Flex\Pages\Page $page): array {
            $data = $page->toPublicArray();
            $data['plugin_fields'] = $this->pageFields->valuesForPage((int) $page->getKey());
            return $data;
        })->all();

        return $this->responses->json(['view' => $view === 'trash' ? 'trash' : 'active', 'page_fields' => $fields, 'pages' => $pageList]);
    }
}
