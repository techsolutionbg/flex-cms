<?php

declare(strict_types=1);

namespace Flex\Http\Controller;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Pages\Page;
use Flex\Pages\PageRepository;
use Flex\Themes\ThemeManager;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class PublicPageController
{
    public function __construct(private PageRepository $pages, private ThemeManager $themes, private ConfigRepositoryInterface $configuration, private ResponseFactoryInterface $responses) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $slug = trim((string) ($arguments['slug'] ?? ''), '/');
        $page = $slug === '' ? $this->homePage() : $this->pages->findPublishedBySlug($slug);
        if (!$page instanceof Page) {
            if (str_contains(strtolower($request->getHeaderLine('Accept')), 'application/json')) {
                return $this->responses->json(['error' => ['status' => 404, 'message' => 'Страницата не е намерена.']], 404);
            }

            return $this->responses->html($this->themes->render('404.twig', ['title' => 'Страницата не е намерена']), 404);
        }
        $settings = is_array($page->getAttribute('settings')) ? $page->getAttribute('settings') : [];
        $title = trim((string) ($settings['seo_title'] ?? '')) ?: (string) $page->getAttribute('title');

        return $this->responses->html($this->themes->render('page.twig', ['page' => $page, 'page_settings' => $settings, 'meta_title' => $title, 'meta_description' => (string) ($settings['meta_description'] ?? ''), 'canonical_url' => (string) ($settings['canonical_url'] ?? '')]));
    }

    private function homePage(): ?Page
    {
        $slug = trim($this->configuration->string('app.public_home_slug', 'home'));

        return $slug === '' ? null : $this->pages->findPublishedBySlug($slug);
    }
}
