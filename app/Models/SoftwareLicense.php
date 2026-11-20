<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SoftwareLicense extends Model
{
    use HasFactory;

    public const CATEGORIES = [
        'productivity',
        'design',
        'development',
        'security',
        'collaboration',
        'analytics',
        'infrastructure',
    ];

    public const LICENSE_TYPES = ['saas', 'perpetual', 'volume'];

    public const BILLING_CYCLES = ['monthly', 'annual', 'one_time'];

    public const STATUSES = ['active', 'suspended', 'cancelled'];

    protected $fillable = [
        'name',
        'vendor',
        'license_key',
        'category',
        'license_type',
        'billing_cycle',
        'total_seats',
        'cost_per_seat',
        'purchase_date',
        'renewal_date',
        'status',
        'notes',
    ];

    protected $casts = [
        'total_seats' => 'integer',
        'cost_per_seat' => 'float',
        'purchase_date' => 'date',
        'renewal_date' => 'date',
    ];

    protected $appends = [
        'renewal_status',
        'days_until_renewal',
        'annualized_cost',
    ];

    public function assignments(): HasMany
    {
        return $this->hasMany(SoftwareLicenseAssignment::class)->orderByDesc('assigned_at');
    }

    public function activeAssignments(): HasMany
    {
        return $this->hasMany(SoftwareLicenseAssignment::class)
            ->whereNull('revoked_at')
            ->orderByDesc('assigned_at');
    }

    /**
     * Determine renewal status ('active', 'expiring_soon', 'expired', 'perpetual', or 'cancelled').
     */
    public function getRenewalStatusAttribute(): string
    {
        if ($this->status === 'cancelled') {
            return 'cancelled';
        }

        if (! $this->renewal_date) {
            return 'perpetual';
        }

        $renewal = Carbon::parse($this->renewal_date)->endOfDay();
        $now = Carbon::now();

        if ($renewal->isPast()) {
            return 'expired';
        }

        $warningDays = (int) config('itam.warranty_warning_days', 60);

        if ($now->diffInDays($renewal, false) <= $warningDays) {
            return 'expiring_soon';
        }

        return 'active';
    }

    /**
     * Signed number of days until license renewal date.
     */
    public function getDaysUntilRenewalAttribute(): ?int
    {
        if (! $this->renewal_date) {
            return null;
        }

        $renewal = Carbon::parse($this->renewal_date)->startOfDay();

        return (int) Carbon::now()->startOfDay()->diffInDays($renewal, false);
    }

    /**
     * Annualized total license spend across all provisioned seats.
     */
    public function getAnnualizedCostAttribute(): float
    {
        $base = $this->total_seats * $this->cost_per_seat;

        if ($this->billing_cycle === 'monthly') {
            return round($base * 12, 2);
        }

        return round($base, 2);
    }
}
