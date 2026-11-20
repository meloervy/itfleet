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
        Schema::table('devices', function (Blueprint $table) {
            $table->string('device_type', 30)->change();
            $table->string('cpu', 150)->nullable()->change();
            $table->string('cpu_tier', 30)->nullable()->change();
            $table->unsignedInteger('ram_gb')->nullable()->change();
            $table->string('storage_type', 20)->nullable()->change();
            $table->unsignedInteger('storage_gb')->nullable()->change();
            $table->string('gpu_tier', 30)->nullable()->default('none')->change();
        });

        Schema::table('devices', function (Blueprint $table) {
            $table->json('specifications')->nullable()->after('gpu_tier');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            $table->dropColumn('specifications');
        });

        Schema::table('devices', function (Blueprint $table) {
            $table->string('device_type', 30)->change();
            $table->string('cpu', 150)->nullable(false)->change();
            $table->string('cpu_tier', 30)->nullable(false)->change();
            $table->unsignedInteger('ram_gb')->nullable(false)->change();
            $table->string('storage_type', 20)->nullable(false)->change();
            $table->unsignedInteger('storage_gb')->nullable(false)->change();
            $table->string('gpu_tier', 30)->nullable(false)->default('none')->change();
        });
    }
};
