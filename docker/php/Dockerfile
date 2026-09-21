FROM composer:2 AS composer

FROM php:8.3-apache

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        git \
        libfreetype6-dev \
        libicu-dev \
        libjpeg62-turbo-dev \
        libonig-dev \
        libpng-dev \
        libzip-dev \
        unzip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        gd \
        intl \
        mbstring \
        opcache \
        pdo_mysql \
        zip \
    && a2enmod rewrite headers expires \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer /usr/bin/composer /usr/local/bin/composer
COPY docker/php/apache.conf /etc/apache2/sites-available/000-default.conf
COPY docker/php/php.ini /usr/local/etc/php/conf.d/flex-cms.ini
COPY docker/php/entrypoint.sh /usr/local/bin/flex-cms-entrypoint

RUN chmod +x /usr/local/bin/flex-cms-entrypoint

WORKDIR /var/www/html

ENTRYPOINT ["flex-cms-entrypoint"]
CMD ["apache2-foreground"]
