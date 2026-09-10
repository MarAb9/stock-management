FROM php:8.4-cli-alpine
RUN docker-php-ext-install pdo_pgsql pdo_sqlite
WORKDIR /app
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY composer.json composer.lock ./
RUN composer install --no-interaction --prefer-dist
COPY . .
