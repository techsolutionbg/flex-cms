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
    storage/tmp \
    storage/backups \
    storage/updates \
    plugins

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
# as www-data. Keep the first source-code permission adjustment narrow and
# limited to the executable directory required by the updater preflight.
if [ "${APP_ENV:-}" = "local" ]; then
    chmod -R a+rwX bin
    chmod -R a+rwX resources/admin-react/dist/assets
fi

chown -R www-data:www-data storage/backups storage/updates
chmod -R u+rwX,g+rwX,o-rwx storage/backups storage/updates

exec "$@"
