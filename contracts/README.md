# Flex CMS contracts

Contracts are stable dependency boundaries, not a mirror of every internal class.

- `Auth`, `Configuration`, `Container`, `Http`, `Session`, and `Updates` are platform contracts shared by more than one module.
- `Extension/V1` is reserved for the first public theme/plugin API. A contract is added there only when an extension can implement it safely.
- Module-private abstractions remain under `src/<Module>/Contracts` (for example the installer contracts).
- Public extension contracts are immutable within their major version. Breaking changes require a new `Extension/V2` namespace and a compatibility period.
- Interfaces use the `Interface` suffix. Implementations use their concrete role and do not repeat `Interface`.

Do not add an interface only to wrap a single concrete class. Add one when it is implemented externally, has multiple runtime implementations, or isolates an infrastructure boundary in tests.
