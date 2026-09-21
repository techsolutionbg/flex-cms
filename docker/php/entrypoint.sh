#!/usr/bin/env sh
set -eu

if [ ! -f vendor/autoload.php ]; then
    composer install --no-interaction --prefer-dist
fi

mkdir -p \
    public/media \
    storage/cache \
    storage/logs \
    storage/sessions \
    storage/tmp

exec "$@"
