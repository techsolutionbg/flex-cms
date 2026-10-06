<?php

declare(strict_types=1);
namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Settings\GeneralSettings;
use Flex\Http\RequestInput;
use Psr\Http\Message\{ServerRequestInterface, ResponseInterface};

final readonly class AdminGeneralSettingsController
{
    public function __construct(private AuthenticationInterface $authentication, private GeneralSettings $settings, private ResponseFactoryInterface $responses, private RequestInput $input) {}
    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        if (!$this->authentication->user()?->isSuperAdmin()) return $this->responses->json(['error' => ['message' => 'Достъпът е забранен.']], 403);
        try {
            $settings = $request->getMethod() === 'PUT' ? $this->settings->save($this->input->all($request)) : $this->settings->all();
            return $this->responses->json(['settings' => $settings, 'options' => ['locales' => ['bg' => 'Български', 'en' => 'English'], 'timezones' => \DateTimeZone::listIdentifiers(), 'date_formats' => GeneralSettings::DATE_FORMATS, 'time_formats' => GeneralSettings::TIME_FORMATS]])->withHeader('Cache-Control', 'no-store');
        } catch (\InvalidArgumentException $error) {
            return $this->responses->json(['error' => ['message' => $error->getMessage()]], 422);
        }
    }
}
