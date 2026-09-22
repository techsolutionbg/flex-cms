FROM node:22-alpine AS frontend
WORKDIR /app/resources/admin
COPY resources/admin/package.json resources/admin/package-lock.json ./
RUN npm ci
COPY resources/admin/ ./
RUN npm run build

FROM composer:2 AS composer
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts

FROM php:8.3-apache AS base
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends curl git libfreetype6-dev libicu-dev libjpeg62-turbo-dev libonig-dev libpng-dev libzip-dev unzip && docker-php-ext-configure gd --with-freetype --with-jpeg && docker-php-ext-install -j"$(nproc)" gd intl mbstring opcache pdo_mysql zip && a2enmod rewrite headers expires && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY docker/php/apache.conf /etc/apache2/sites-available/000-default.conf
COPY docker/php/php.ini /usr/local/etc/php/conf.d/flex-cms.ini
COPY docker/php/entrypoint.sh /usr/local/bin/flex-cms-entrypoint
RUN chmod +x /usr/local/bin/flex-cms-entrypoint
WORKDIR /var/www/html
ENTRYPOINT ["flex-cms-entrypoint"]
CMD ["apache2-foreground"]

FROM base AS development

FROM base AS production
COPY . /var/www/html
COPY --from=composer /app/vendor /var/www/html/vendor
COPY --from=frontend /app/public/build /var/www/html/public/build
RUN rm -rf resources/admin node_modules tests .git .github docker compose.yaml && mkdir -p public/media storage/cache storage/logs storage/sessions storage/tmp && chown -R www-data:www-data public/media storage
