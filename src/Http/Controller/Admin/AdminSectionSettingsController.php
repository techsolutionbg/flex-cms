<?php
declare(strict_types=1);
namespace Flex\Http\Controller\Admin;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Settings\SectionSettings;
use Flex\Http\RequestInput;
use Psr\Http\Message\{ServerRequestInterface, ResponseInterface};
final readonly class AdminSectionSettingsController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private SectionSettings $settings,
        private ResponseFactoryInterface $responses,
        private RequestInput $input,
        private \Flex\Settings\PlatformDiagnostics $diagnostics,
    ) {}
    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        if (!$this->authentication->user()?->isSuperAdmin()) return $this->responses->json(['error' => ['message' => 'Достъпът е забранен.']], 403);
        $section = $arguments['section'] ?? '';
        try {
            $values = $request->getMethod() === 'PUT' ? $this->settings->save($section, $this->input->all($request)) : $this->settings->all($section);
            $pages = $section === 'public' ? \Flex\Pages\Page::query()->where('status', 'published')->orderBy('title')->get(['id', 'title'])->toArray() : [];
            $settingsPayload = $section === 'maintenance' ? new \stdClass() : $values;
            $diagnostics = null;
            if ($section === 'maintenance') {
                try {
                    $diagnostics = $this->diagnostics->check();
                } catch (\Throwable) {
                    $diagnostics = ['Диагностика' => 'Грешка при проверката на сървъра.'];
                }
            }

            return $this->responses->json([
                'settings' => $settingsPayload,
                'pages' => $pages,
                'mail' => $section === 'mail' ? $this->settings->mailOverview() : null,
                'diagnostics' => $diagnostics,
            ])->withHeader('Cache-Control', 'no-store');
        } catch (\InvalidArgumentException $error) { return $this->responses->json(['error' => ['message' => $error->getMessage()]], in_array($error->getCode(), [404, 405], true) ? $error->getCode() : 422); }
    }
}
