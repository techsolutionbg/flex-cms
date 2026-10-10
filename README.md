# Flex CMS

Flex CMS is a modular CMS platform for PHP 8.3+ and MySQL 8.0+, designed for conventional web hosting. Production packages include compiled frontend assets and Composer dependencies, so the server does not need Node.js, Composer, SSH, Redis or a persistent worker.

The project is under active development. The core includes configuration and container bootstrapping, a database manager, a web installer, an application kernel, authentication and a protected platform update mechanism.

## Quick start

Docker and Docker Compose are required for the local development environment:

```bash
cp .env.example .env
docker compose up --build
```

On Windows PowerShell, use `Copy-Item .env.example .env` to copy the environment file.

- Website: `http://localhost:8090`
- Administration: `http://localhost:8090/admin`
- Installer: `http://localhost:8090/install`
- Health check: `http://localhost:8090/health`
- phpMyAdmin: `http://localhost:8081`
- Mailpit: `http://localhost:8025`

Within the Docker network, the MySQL host is `mysql`. The default database and application user are both `flex_cms`. Local connection settings and forwarded ports can be configured in `.env`; the Compose MySQL service initializes the `flex_cms` database and user.

### Docker services and ports

The default local configuration starts the following services. Published host ports can be changed through `.env`.

| Service | Docker service | Host port | Container port | Purpose |
| --- | --- | ---: | ---: | --- |
| PHP application | `app` | — | `80` | Internal PHP backend, accessed through the unified development entry point |
| Development entry point | `frontend-react` | `8090` | `8090` | Website, administration and installer; Vite/React HMR and PHP proxy |
| MySQL | `mysql` | `3306` | `3306` | Database |
| phpMyAdmin | `phpmyadmin` | `8081` | `80` | Browser-based MySQL administration |
| Mailpit SMTP | `mailpit` | `1025` | `1025` | Captures outgoing development email |
| Mailpit web interface | `mailpit` | `8025` | `8025` | Displays captured email |
| Update worker | `updater` | — | — | Processes queued platform updates inside the Docker environment |

Use `VITE_REACT_FORWARD_PORT` for the unified development port and `DB_FORWARD_PORT` for the MySQL host port. The PHP backend has no published host port. In this Compose configuration, Vite runs on the unified port `8090`.

## Administration and development checks

```bash
docker compose exec app composer check
npm --prefix resources/admin-react ci
npm --prefix resources/admin-react run typecheck
npm --prefix resources/admin-react run build:admin
npm --prefix resources/admin-react run build:installer
```

The React application in `resources/admin-react/` is the platform's administration interface, available at `/admin`. Installation also uses a React interface at `/install`; after installation, open `/admin/login`.

## Project structure

```text
bin/                    CLI entry point
config/                 Application and container configuration
contracts/              Versioned public extension API
database/               Phinx migrations
docker/                 Development and production images
docs/                   Architecture and workflow documentation
plugins/                Installed plugin packages
public/                 Web root and production assets
resources/admin-react/  React administration and installer
resources/views/        Twig and server-rendered templates
src/                    Platform modules and shared infrastructure
storage/                Environment, cache, logs and update runtime data
tests/                  Backend, architecture and integration tests
themes/                 Installed theme packages; themes may have separate Git repositories
```

Frontend source files are not served directly. Development uses Vite; production uses compiled React bundles in `public/build/react-admin/` and `public/build/installer/`.

## Development and deployment workflows

- Development, tests and static analysis: [Development guide](docs/DEVELOPMENT.md)
- Release packages and production deployment: [Release guide](docs/RELEASE.md)
- Backend boundaries: [Backend architecture](docs/BACKEND_ARCHITECTURE.md)
- Environment settings: [Environment guide](docs/ENVIRONMENT.md)
- Dependencies: [Dependencies](docs/DEPENDENCIES.md)
- Detailed directory structure: [Project structure](docs/PROJECT_STRUCTURE.md)

Some linked documents are currently written in Bulgarian.

### Building a release

Versions follow Semantic Versioning: `MAJOR.MINOR.PATCH`. From the project root, build a package using:

```bash
php flex platform:release --bump=patch
php flex platform:release --bump=minor
php flex platform:release --bump=major
```

For example, starting at `0.1.43`, these options produce `0.1.44`, `0.2.0` or `1.0.0`, respectively. `platform:release` is an alias for `platform:build`.

To build and publish directly to the configured update host:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish_update.ps1 `
  -TargetVersion 0.1.43 -ReleaseNotes "Description of changes"
```

The version in this example is illustrative; specify the intended release version.

`platform:release` writes the ZIP package and checksum file to `releases/<version>/`. `platform:publish` runs the local PowerShell publisher, builds assets through Docker, signs the package and catalogue with the local Ed25519 key, and uploads the ZIP, checksum and catalogue to the update host over SSH/SCP. GitHub Actions are not part of this release workflow. Publishing requires clean, committed platform changes. Frontend source files are excluded from the package; compiled React bundles are included.

Create a local `.publish.env` from [.publish.env.example](.publish.env.example), configure the SSH alias and key path, and verify that `UPDATE_SERVER_URL` in `.env` points to the same update host. The publisher runs on Windows 11 with Docker Desktop and Windows OpenSSH (`ssh`/`scp`). PHP 8.3+ and Composer dependencies must be available in the `app` container. The deployment key stays in Windows OpenSSH or the SSH agent; the signing private key stays local and must not be committed.

Numeric bump values are also supported: `--bump=1` for major, `--bump=2` for minor and `--bump=3` for patch. If neither `--bump` nor `--target-version` is provided, the patch version is incremented. Do not specify both options together. `platform:release` only builds a package; `platform:publish` builds and publishes it to the update host.

## Architectural boundaries

- The core does not depend on a particular theme or plugin.
- Extensions use the versioned contracts in `contracts/Extension/V1`.
- Deactivation preserves data; removal is a separate, explicit uninstall operation.
- Application code receives configuration and infrastructure through the container.
- Controllers coordinate HTTP requests; HTML belongs in the view layer.
- `storage/` and `public/media/` contain runtime data and are excluded from platform update packages.

## Production requirements

- PHP 8.3+, 64-bit, PDO MySQL and the extensions listed in `composer.json`.
- MySQL 8.0+.
- Apache, Nginx or LiteSpeed with the document root set to `public/`.
- HTTPS and outbound HTTPS access for automatic updates.
- Write permissions for `storage/`, `public/media/`, `plugins/` and the configured themes directory.
- A recommended `memory_limit` of at least 256 MB.

Never point the document root at the project root. Do not deploy the development `.env`, `node_modules`, tests or frontend source files to production. Use the production release package, which includes the required dependencies and compiled assets.

### Optimized media previews

In development, generate WebP previews for existing images in bounded, resumable batches:

```sh
php -d memory_limit=512M bin/flex media:thumbnails --limit=100
php -d memory_limit=512M bin/flex media:thumbnails --after-id=100 --limit=100
```

Use the last ID printed by the previous batch. Add `--force` after changing the preview size. Originals remain unchanged. Failed files are reported individually; the command returns a nonzero exit code when a file fails. PNG is retained as a fallback on servers without GD WebP support.

Preview size follows Settings → Media library. Missing previews use a lightweight placeholder in the media browser until generated. Media responses support HTTP validators and versioned preview caching. This command does not create a release or deploy to hosting.
