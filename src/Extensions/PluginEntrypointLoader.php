<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extension\V1\PluginInterface;
use Flex\Extensions\Exception\PluginLifecycleException;

final class PluginEntrypointLoader
{
    /** @var array<string, true> */
    private array $registeredAutoloaders = [];

    public function load(PluginManifest $manifest, string $pluginPath): PluginInterface
    {
        $this->registerAutoloaders($manifest, $pluginPath);

        if (!class_exists($manifest->entrypoint)) {
            throw new PluginLifecycleException(sprintf('Plugin entrypoint "%s" could not be loaded.', $manifest->entrypoint));
        }

        $entrypoint = new $manifest->entrypoint();
        if (!$entrypoint instanceof PluginInterface) {
            throw new PluginLifecycleException(sprintf('Plugin entrypoint "%s" must implement %s.', $manifest->entrypoint, PluginInterface::class));
        }

        return $entrypoint;
    }

    private function registerAutoloaders(PluginManifest $manifest, string $pluginPath): void
    {
        foreach ($manifest->autoload as $namespace => $relativePath) {
            $key = $manifest->id . ':' . $pluginPath . ':' . $namespace . ':' . $relativePath;
            if (isset($this->registeredAutoloaders[$key])) {
                continue;
            }

            $basePath = rtrim($pluginPath . '/' . trim($relativePath, '/'), '/');
            spl_autoload_register(static function (string $class) use ($namespace, $basePath): void {
                if (!str_starts_with($class, $namespace)) {
                    return;
                }

                $relativeClass = substr($class, strlen($namespace));
                $file = $basePath . '/' . str_replace('\\', '/', $relativeClass) . '.php';
                if (is_file($file)) {
                    require_once $file;
                }
            });
            $this->registeredAutoloaders[$key] = true;
        }
    }
}
