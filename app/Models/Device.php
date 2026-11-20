<?php

namespace App\Models;

use App\Services\HardwareImageService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Device extends Model
{
    use HasFactory;

    public const COMPUTE_TYPES = ['laptop', 'desktop'];

    public const ALL_TYPES = ['laptop', 'desktop', 'monitor', 'mobile', 'peripheral'];

    protected $fillable = [
        'asset_tag',
        'serial_number',
        'barcode',
        'techspecs_id',
        'image_url',
        'device_type',
        'brand',
        'model',
        'location',
        'cpu',
        'cpu_tier',
        'ram_gb',
        'storage_type',
        'storage_gb',
        'gpu',
        'gpu_tier',
        'specifications',
        'year_acquired',
        'purchase_cost',
        'purchase_date',
        'depreciation_rate_percent',
        'vendor',
        'warranty_start',
        'warranty_expiry',
        'contract_sla',
        'condition',
        'status',
        'lifecycle_stage',
        'notes',
    ];

    protected $casts = [
        'ram_gb' => 'integer',
        'storage_gb' => 'integer',
        'specifications' => 'array',
        'year_acquired' => 'integer',
        'purchase_cost' => 'float',
        'purchase_date' => 'date',
        'depreciation_rate_percent' => 'float',
        'warranty_start' => 'date',
        'warranty_expiry' => 'date',
    ];

    protected $appends = [
        'current_book_value',
        'warranty_status',
        'days_until_warranty_expiry',
        'image_clip_url',
        'spec_summary',
    ];

    protected static function booted(): void
    {
        static::deleting(function (Device $device) {
            if ($device->activeAssignment()->exists() || $device->status === 'assigned') {
                throw new \DomainException("Cannot delete device {$device->asset_tag}: it is currently assigned to an employee.");
            }
        });
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class);
    }

    public function activeAssignment(): HasOne
    {
        return $this->hasOne(Assignment::class)->whereNull('unassigned_at');
    }

    public function maintenanceLogs(): HasMany
    {
        return $this->hasMany(MaintenanceLog::class)->orderByDesc('started_at');
    }

    public function lifecycleEvents(): HasMany
    {
        return $this->hasMany(LifecycleEvent::class)->orderByDesc('created_at');
    }

    public function scopeAvailable($query)
    {
        return $query->where('status', 'available')
            ->whereNotIn('condition', ['needs_repair', 'retired']);
    }

    public function scopeReclaimed($query)
    {
        return $query->where('lifecycle_stage', 'reclaimed');
    }

    public function scopeDeployment($query)
    {
        return $query->where('lifecycle_stage', 'deployment');
    }

    public function scopeCompute($query)
    {
        return $query->whereIn('device_type', self::COMPUTE_TYPES);
    }

    /**
     * Determine if this device is a compute workstation eligible for workload matching.
     */
    public function isComputeDevice(): bool
    {
        return in_array($this->device_type, self::COMPUTE_TYPES, true);
    }

    /**
     * Determine if device is aging (>= 3 years old in service).
     */
    public function isAging(): bool
    {
        if ($this->purchase_date) {
            return Carbon::parse($this->purchase_date)->diffInYears(Carbon::now()) >= 3;
        }

        if ($this->year_acquired) {
            return (Carbon::now()->year - $this->year_acquired) >= 3;
        }

        return false;
    }

    /**
     * Determine if warranty is expired or nearing expiry (<= 60 days).
     */
    public function isWarrantyAtRisk(): bool
    {
        return in_array($this->warranty_status, ['expired', 'expiring_soon', 'none'], true);
    }

    /**
     * Determine if device has condition or maintenance risk.
     */
    public function hasConditionRisk(): bool
    {
        $cond = strtolower($this->condition ?? 'good');

        return in_array($cond, ['fair', 'poor', 'degraded', 'needs_repair'], true)
            || $this->status === 'in_repair'
            || $this->lifecycle_stage === 'maintenance';
    }

    /**
     * Compute current depreciated book value using straight-line annual depreciation.
     */
    public function getCurrentBookValueAttribute(): float
    {
        $categoryFallback = match ($this->device_type) {
            'monitor' => 18000.00,
            'mobile' => 38000.00,
            'peripheral' => 8500.00,
            default => (float) config('itam.default_purchase_cost', 65000.00),
        };
        $cost = $this->purchase_cost ?? $categoryFallback;
        $rate = ($this->depreciation_rate_percent ?? 20.00) / 100.0;

        $now = Carbon::now();
        $startDate = $this->purchase_date
            ? Carbon::parse($this->purchase_date)
            : Carbon::createFromDate($this->year_acquired ?: $now->year, 1, 1);

        $yearsElapsed = $startDate->isFuture()
            ? 0.0
            : max(0.0, $startDate->diffInDays($now, false) / 365.25);

        $depreciated = $cost * (1 - ($rate * $yearsElapsed));
        $salvageFloor = $cost * 0.10; // 10% salvage residual value floor

        return round(max($salvageFloor, $depreciated), 2);
    }

    /**
     * Determine warranty status ('active', 'expiring_soon', 'expired', or 'none').
     */
    public function getWarrantyStatusAttribute(): string
    {
        if (! $this->warranty_expiry) {
            return 'none';
        }

        $expiry = Carbon::parse($this->warranty_expiry)->endOfDay();
        $now = Carbon::now();

        if ($expiry->isPast()) {
            return 'expired';
        }

        $warningDays = (int) config('itam.warranty_warning_days', 60);

        if ($now->diffInDays($expiry, false) <= $warningDays) {
            return 'expiring_soon';
        }

        return 'active';
    }

    /**
     * Number of days until warranty expiry.
     */
    public function getDaysUntilWarrantyExpiryAttribute(): ?int
    {
        if (! $this->warranty_expiry) {
            return null;
        }

        $expiry = Carbon::parse($this->warranty_expiry)->startOfDay();

        return (int) Carbon::now()->startOfDay()->diffInDays($expiry, false);
    }

    /**
     * Resolved image clip URL from public asset library, Google Image Search, or authentic hardware registry.
     */
    public function getImageClipUrlAttribute(): string
    {
        return HardwareImageService::resolveForDevice($this);
    }

    /**
     * Human-readable specification summary across compute and non-compute categories.
     */
    public function getSpecSummaryAttribute(): string
    {
        if ($this->isComputeDevice()) {
            $parts = array_filter([
                $this->cpu,
                $this->ram_gb ? "{$this->ram_gb}GB RAM" : null,
                $this->storage_gb ? trim("{$this->storage_gb}GB ".($this->storage_type ?? '')) : null,
            ]);

            return ! empty($parts) ? implode(' • ', $parts) : ucfirst((string) $this->device_type);
        }

        $specs = is_array($this->specifications) ? $this->specifications : [];
        $preferredKeys = ['screen_size', 'resolution', 'panel_type', 'refresh_rate', 'os', 'storage', 'subtype', 'connectivity', 'carrier', 'imei'];
        $parts = [];

        foreach ($preferredKeys as $key) {
            if (! empty($specs[$key])) {
                $parts[] = trim((string) $specs[$key]);
            }
        }

        foreach ($specs as $key => $val) {
            if (! in_array($key, $preferredKeys, true) && ! empty($val)) {
                $parts[] = trim((string) $val);
            }
        }

        if ($this->storage_gb && empty($specs['storage'])) {
            $parts[] = "{$this->storage_gb}GB".($this->storage_type ? " {$this->storage_type}" : '');
        }

        return ! empty($parts) ? implode(' • ', $parts) : ucfirst((string) $this->device_type);
    }
}
