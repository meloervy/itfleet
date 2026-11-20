# ITFleet — Enterprise IT Asset Management

ITFleet is an internal IT Asset Management (ITAM) platform built with Laravel, Inertia.js, React, and Tailwind CSS. It tracks hardware inventory, lifecycle stages, depreciation, maintenance logs, employee allocations, and AI-assisted hardware matching.

## Local Setup

```bash
composer install
npm install --legacy-peer-deps
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
npm run build
php artisan serve
```

## Demo Accounts (Local Environment Only)

When running in `local` environment, 1-click demo login cards are available on `/login` (`password` for all accounts):

| Role | Email |
| :--- | :--- |
| IT Administrator | `admin@itfleet.local` |
| Asset Manager | `manager@itfleet.local` |
| Hardware Technician | `tech@itfleet.local` |

## Testing

```bash
php artisan test
```
