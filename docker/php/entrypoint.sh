#!/usr/bin/env sh
set -eu

if [ -d .git ]; then
    git config --global --add safe.directory /var/www/html
fi

if [ ! -f vendor/autoload.php ]; then
    composer install --no-interaction --prefer-dist
fi

mkdir -p \
    public/media \
    storage/cache \
    storage/logs \
    storage/sessions \
    storage/tmp

chmod a+rwX storage

# Create only the empty environment placeholder needed by the first-run
# installer. The installer replaces it with the real .env atomically.
if [ ! -s .env ]; then
    touch .env
    chown www-data:www-data .env
    chmod 0600 .env
fi

# Development bind mounts retain host ownership. Only runtime-writable paths
# are opened for Apache; application source and configuration remain read-only.
chmod -R a+rwX \
    public/media \
    storage/cache \
    storage/logs \
    storage/sessions \
    storage/tmp

exec "$@"
