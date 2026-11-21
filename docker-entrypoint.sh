#!/bin/sh
set -e

echo "==> Preparing ITFleet for production startup..."

# Ensure database directory and SQLite file exist
mkdir -p /app/database /app/storage/framework/cache /app/storage/framework/sessions /app/storage/framework/views /app/storage/logs /app/bootstrap/cache
if [ ! -f /app/database/database.sqlite ]; then
    echo "==> Creating SQLite database file..."
    touch /app/database/database.sqlite
fi

# Ensure storage directory permissions
chmod -R 775 /app/storage /app/bootstrap/cache /app/database

# Check if APP_KEY is set, generate if missing
if [ -z "$APP_KEY" ]; then
    if [ -f /app/.env ]; then
        echo "==> Generating application key..."
        php artisan key:generate --force
    else
        echo "==> Generating ephemeral APP_KEY for this container instance..."
        export APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
    fi
fi

# Run database migrations and seeding if needed
echo "==> Running database migrations..."
php artisan migrate --force --no-interaction

# Check if devices or users table is empty, seed if necessary
DEVICE_COUNT=$(php -r "require '/app/vendor/autoload.php'; \$app = require '/app/bootstrap/app.php'; \$kernel = \$app->make(Illuminate\Contracts\Console\Kernel::class); \$kernel->bootstrap(); echo \App\Models\Device::count();" 2>/dev/null || echo "0")
USER_COUNT=$(php -r "require '/app/vendor/autoload.php'; \$app = require '/app/bootstrap/app.php'; \$kernel = \$app->make(Illuminate\Contracts\Console\Kernel::class); \$kernel->bootstrap(); echo \App\Models\User::count();" 2>/dev/null || echo "0")

if [ "$DEVICE_COUNT" = "0" ]; then
    echo "==> Seeding initial IT fleet catalog, employee profiles, and demo users..."
    php artisan db:seed --force --no-interaction
elif [ "$USER_COUNT" = "0" ]; then
    echo "==> Seeding demo administrative users..."
    php artisan db:seed --class=UserSeeder --force --no-interaction
fi

# Optimize Laravel caching for production
echo "==> Optimizing caches..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Determine port
SERVER_PORT="${PORT:-8080}"
echo "==> ITFleet is ready! Serving on 0.0.0.0:${SERVER_PORT}..."

# Exec web server
export PHP_CLI_SERVER_WORKERS="${PHP_CLI_SERVER_WORKERS:-4}"
cd /app/public
exec php -d variables_order=EGPCS -S "0.0.0.0:${SERVER_PORT}" /app/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
