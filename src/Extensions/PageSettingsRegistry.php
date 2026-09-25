<?php

declare(strict_types=1);

namespace Flex\Extensions;

/**
 * Registry for plugin-provided page settings shown on the page settings screen.
 * It intentionally shares the same field contract as page fields while keeping
 * the two UI locations and payloads separate.
 */
final class PageSettingsRegistry extends PageFieldRegistry {}
