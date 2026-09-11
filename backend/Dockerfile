FROM php:8.4-cli-alpine
RUN apk add --no-cache libpq-dev sqlite-dev \
    && docker-php-ext-install bcmath pdo_pgsql pdo_sqlite
WORKDIR /app
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY composer.json composer.lock ./
RUN composer install --no-interaction --prefer-dist --no-scripts
COPY . .
RUN composer dump-autoload --optimize
