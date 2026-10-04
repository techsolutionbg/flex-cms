# Environment variable inventory

Runtime application keys are read by files in `config/`: `APP_*`, database connection keys, session, cache, logging, filesystem/media, mail, extension/update, trusted-host and HTTPS keys.

Development orchestration keys are consumed by Docker Compose: `APP_PORT`, `DB_FORWARD_PORT`, `DB_ROOT_PASSWORD`, `PMA_*`, and `VITE_REACT_FORWARD_PORT`. They are documented in `.env.example` but are not application configuration.

Secrets must never be committed; `.env.example` contains safe placeholders only.

Removed keys must be deleted from both configuration and `.env.example`. Adding a runtime key requires a typed config entry and validation when invalid values could weaken production security.
