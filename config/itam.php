<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Default Financial & Lifecycle Settings
    |--------------------------------------------------------------------------
    */
    'currency' => env('ITAM_CURRENCY', 'PHP'),
    'default_purchase_cost' => (float) env('ITAM_DEFAULT_PURCHASE_COST', 65000.00),
    'warranty_warning_days' => (int) env('ITAM_WARRANTY_WARNING_DAYS', 60),
    'demo_mode' => filter_var(env('ITFLEET_DEMO_MODE', true), FILTER_VALIDATE_BOOLEAN),
    'default_demo_preset' => env('ITFLEET_DEMO_PRESET', 'small'),
];
