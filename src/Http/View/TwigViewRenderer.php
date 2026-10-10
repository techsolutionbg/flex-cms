<?php

declare(strict_types=1);

namespace Flex\Http\View;

use Flex\Contracts\Http\ViewRendererInterface;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;
use Twig\TwigFunction;
use Flex\Extension\V1\Time;

final readonly class TwigViewRenderer implements ViewRendererInterface
{
    private Environment $twig;

    public function __construct(string $basePath)
    {
        $this->twig = new Environment(
            new FilesystemLoader($basePath . '/resources/views'),
            ['cache' => false, 'strict_variables' => true],
        );
        $this->twig->addFunction(new TwigFunction('flex_time', static fn(mixed $value, string $style = 'datetime'): string => Time::html($value, $style), ['is_safe' => ['html']]));
    }

    public function render(string $template, array $data = []): string
    {
        return $this->twig->render($template, $data);
    }
}
