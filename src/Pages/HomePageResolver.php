<?php

declare(strict_types=1);

namespace Flex\Pages;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Settings\SectionSettings;

/** The page served at "/": the „Начална страница“ setting, else the page with the configured home slug. */
final readonly class HomePageResolver
{
    public function __construct(
        private ConfigRepositoryInterface $configuration,
        private ?SectionSettings $siteSettings = null,
    ) {}

    public function resolve(PublicPageSet $pages): ?Page
    {
        $id = (int) ($this->siteSettings?->all('public')['home_page_id'] ?? 0);
        if ($id > 0) {
            return $pages->findPublishedById($id);
        }
        $slug = trim($this->configuration->string('app.public_home_slug', 'home'));

        return $slug === '' ? null : $pages->findPublishedBySlug($slug);
    }
}
