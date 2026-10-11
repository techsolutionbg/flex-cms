<?php

declare(strict_types=1);

namespace Flex\Themes;

/**
 * HTML built when a template first prints it. Plugin asset tags are passed to themes this way, so groups that
 * plugins ask for while the template runs (for example home page product cards) are still included.
 */
final class DeferredHtml implements \Stringable
{
    private ?string $html = null;

    /** @param \Closure(): string $build */
    public function __construct(private readonly \Closure $build) {}

    public function __toString(): string
    {
        return $this->html ??= ($this->build)();
    }
}
