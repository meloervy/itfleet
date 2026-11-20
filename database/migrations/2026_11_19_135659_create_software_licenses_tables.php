<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('software_licenses', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('vendor', 120);
            $table->string('license_key', 255)->nullable();
            $table->string('category', 60)->default('productivity')->index();
            $table->string('license_type', 30)->default('saas')->index();
            $table->string('billing_cycle', 20)->default('annual');
            $table->unsignedInteger('total_seats');
            $table->decimal('cost_per_seat', 10, 2)->default(0);
            $table->date('purchase_date')->nullable();
            $table->date('renewal_date')->nullable()->index();
            $table->string('status', 30)->default('active')->index();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('software_license_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('software_license_id')->constrained('software_licenses')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->timestamp('assigned_at');
            $table->timestamp('revoked_at')->nullable()->index();
            $table->foreignId('assigned_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['software_license_id', 'revoked_at']);
            $table->index(['employee_id', 'revoked_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('software_license_assignments');
        Schema::dropIfExists('software_licenses');
    }
};
