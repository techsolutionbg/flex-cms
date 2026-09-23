# Extension API v1

Version 1 exposes the minimum plugin lifecycle contract. A plugin entrypoint must implement
`PluginInterface` and receive a read-only `PluginContext` when it is installed, activated or
deactivated. The context contains the plugin id, version, installation path and validated
manifest data. An optional `UninstallablePluginInterface` can be implemented when a plugin
needs to remove its own versioned data. Internal platform services are deliberately not
exposed through this API. An optional `UpdatablePluginInterface` can run plugin-specific
migrations when a discovered package has a newer version than the installed one.
