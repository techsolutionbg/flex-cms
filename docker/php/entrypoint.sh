#!/usr/bin/env sh
set -eu

if [ -d .git ] && [ "$(id -u)" = "0" ]; then
    git config --global --add safe.directory /var/www/html
fi

if [ "$(id -u)" = "0" ]; then
    if [ ! -f vendor/autoload.php ]; then
        composer install --no-interaction --prefer-dist
    fi

    mkdir -p \
        public/media \
        storage/cache \
        storage/logs \
        storage/sessions \
        storage/tmp \
        storage/backups \
        storage/updates \
        plugins \
        themes

    chmod a+rwX storage

    # Development bind mounts retain host ownership. Only runtime-writable paths
    # are opened for Apache; application source remains read-only.
    chmod -R a+rwX \
        public/media \
        storage/cache \
        storage/logs \
        storage/sessions \
        storage/tmp \
        storage/backups \
        storage/updates \
        plugins

    # The local bind mount can be owned by the host user while the updater runs
    # as the host UID/GID. Keep the source-code permission adjustment narrow.
    if [ "${APP_ENV:-}" = "local" ]; then
        chmod -R a+rwX bin
        chmod -R a+rwX resources/admin-react/dist/assets
    fi

    runtime_gid="${FLEX_CMS_GID:-1000}"
    if [ -f storage/.env ]; then
        chgrp "$runtime_gid" storage/.env
        chmod 640 storage/.env
    fi
    if [ -d themes ]; then
        chown -R "www-data:$runtime_gid" themes
        chmod -R u+rwX,g+rwX,o-rwx themes
    fi
    # Apache runs as www-data while the updater runs as the host runtime user.
    # Keep www-data as owner and the updater group as the shared group so both
    # processes can create and lock queue/backup files after a clean install.
    chown -R "www-data:$runtime_gid" storage/backups storage/updates
    chmod -R u+rwX,g+rwX,o-rwx storage/backups storage/updates
fi

exec "$@"
