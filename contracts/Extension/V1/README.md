# Extension API v1

Version 1 exposes the minimum plugin lifecycle contract. A plugin entrypoint must implement
`PluginInterface` and receive a read-only `PluginContext` when it is installed, activated or
deactivated. The context contains the plugin id, version, installation path and validated
manifest data and declared permissions. Permission checks use a default-deny policy:
`routes.public` is required for plugin routes and `frontend.assets` is required for
frontend CSS/JavaScript assets. An optional `UninstallablePluginInterface` can be implemented when a plugin
needs to remove its own versioned data. Internal platform services are deliberately not
exposed through this API. An optional `UpdatablePluginInterface` can run plugin-specific
migrations when a discovered package has a newer version than the installed one.

Declared permissions are stored as requested permissions during installation. A super
administrator must approve them before activation; runtime contexts, routes and frontend
assets receive only approved permissions. Permission changes require the plugin to be inactive.

Declared permissions are stored as requested permissions during installation. A super
administrator must approve them before activation; runtime contexts and frontend assets
receive only approved permissions. Permission changes require the plugin to be inactive.
The `ExtensionApiInterface` provides namespaced actions and filters. Plugins can register
callbacks during their lifecycle and use `applyFilters()` or `doAction()` without depending
on internal framework services. Active plugins that implement `BootablePluginInterface` are
booted once per application request before routing starts.
During boot, `PluginContext::$routes` can register namespaced routes. A route such as
`/hello` is exposed as `/plugins/{plugin-id}/hello`; route names are automatically
namespaced and plugin middleware can be supplied when needed.
Core events are exposed through `EventNames` and immutable event objects such as
`PluginEvent` and `PageEvent`. Listeners are ordered by priority and receive only the
validated public payload.
