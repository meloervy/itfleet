<?php

namespace App\Services\Ai;

use App\Services\HardwareImageService;

class DeviceSpecHeuristicResolver
{
    /**
     * Infer realistic hardware specifications locally when Gemini API is offline or unavailable.
     *
     * @return array{
     *     brand: string,
     *     model: string,
     *     device_type: string,
     *     cpu: string,
     *     cpu_tier: string,
     *     ram_gb: int,
     *     storage_type: string,
     *     storage_gb: int,
     *     gpu: string,
     *     gpu_tier: string,
     *     year_acquired: int,
     *     image_url: ?string
     * }
     */
    public function resolve(string $input): array
    {
        $clean = trim($input);
        $lower = strtolower($clean);

        $brand = 'Lenovo';
        if (str_contains($lower, 'apple') || str_contains($lower, 'macbook') || str_contains($lower, 'mac') || str_contains($lower, 'imac')) {
            $brand = 'Apple';
        } elseif (str_contains($lower, 'microsoft') || str_contains($lower, 'surface')) {
            $brand = 'Microsoft';
        } elseif (str_contains($lower, 'dell') || str_contains($lower, 'xps') || str_contains($lower, 'latitude') || str_contains($lower, 'optiplex') || str_contains($lower, 'precision') || str_contains($lower, 'alienware')) {
            $brand = 'Dell';
        } elseif (str_contains($lower, 'hp') || str_contains($lower, 'elitebook') || str_contains($lower, 'probook') || str_contains($lower, 'zbook') || str_contains($lower, 'pavilion') || str_contains($lower, 'omen') || str_contains($lower, 'prodesk') || str_contains($lower, 'elitedesk') || str_contains($lower, 'omnibook')) {
            $brand = 'HP';
        } elseif (str_contains($lower, 'lenovo') || str_contains($lower, 'thinkpad') || str_contains($lower, 'ideapad') || str_contains($lower, 'legion') || str_contains($lower, 'thinkcentre') || str_contains($lower, 'yoga')) {
            $brand = 'Lenovo';
        } elseif (str_contains($lower, 'asus') || str_contains($lower, 'zenbook') || str_contains($lower, 'rog') || str_contains($lower, 'tuf') || str_contains($lower, 'vivobook')) {
            $brand = 'ASUS';
        } elseif (str_contains($lower, 'acer') || str_contains($lower, 'aspire') || str_contains($lower, 'predator') || str_contains($lower, 'swift')) {
            $brand = 'Acer';
        } elseif (str_contains($lower, 'samsung') || str_contains($lower, 'galaxy book')) {
            $brand = 'Samsung';
        } elseif (str_contains($lower, 'google') || str_contains($lower, 'pixelbook')) {
            $brand = 'Google';
        } elseif (str_contains($lower, 'razer') || str_contains($lower, 'blade')) {
            $brand = 'Razer';
        } elseif (str_contains($lower, 'framework')) {
            $brand = 'Framework';
        } elseif (str_contains($lower, 'msi')) {
            $brand = 'MSI';
        } elseif (str_contains($lower, 'minisforum')) {
            $brand = 'Minisforum';
        } elseif (str_contains($lower, 'beelink')) {
            $brand = 'Beelink';
        } elseif (str_contains($lower, 'chromebook')) {
            $brand = 'Acer';
        }

        $isDesktop = str_contains($lower, 'desktop')
            || str_contains($lower, 'optiplex')
            || str_contains($lower, 'tower')
            || str_contains($lower, 'mac studio')
            || str_contains($lower, 'mac pro')
            || str_contains($lower, 'mac mini')
            || str_contains($lower, 'mini pc')
            || str_contains($lower, 'nuc')
            || str_contains($lower, 'tiny')
            || str_contains($lower, 'imac')
            || str_contains($lower, 'thinkcentre')
            || str_contains($lower, 'prodesk')
            || str_contains($lower, 'elitedesk')
            || str_contains($lower, 'minisforum')
            || str_contains($lower, 'beelink')
            || (str_contains($lower, 'workstation') && ! str_contains($lower, 'mobile') && ! str_contains($lower, 'laptop') && ! str_contains($lower, 'zbook') && ! str_contains($lower, 'precision laptop'))
            || str_contains($lower, 'rig');
        $deviceType = $isDesktop ? 'desktop' : 'laptop';

        $cpuName = 'Intel Core i5-1335U';
        $cpuTier = 'mid';
        $gpu = 'Integrated Graphics';
        $gpuTier = 'integrated';
        $defaultRam = 16;
        $defaultStorage = 512;
        $inferredYear = (int) date('Y');

        if ($brand === 'Apple') {
            if (preg_match('/\bm([1-9])(?:\s*(pro|max|ultra))?\b/i', $input, $appleMatch)) {
                $gen = (int) $appleMatch[1];
                $variant = strtolower($appleMatch[2] ?? '');

                if ($variant === 'ultra') {
                    $cpuName = "Apple M{$gen} Ultra";
                    $cpuTier = 'workstation';
                    $gpu = 'Apple '.($gen >= 3 ? 80 : 64).'-core GPU';
                    $gpuTier = 'dedicated-high';
                    $defaultRam = 64;
                    $defaultStorage = 2048;
                } elseif ($variant === 'max') {
                    $cpuName = "Apple M{$gen} Max";
                    $cpuTier = 'high';
                    $gpu = 'Apple '.($gen >= 3 ? 40 : 32).'-core GPU';
                    $gpuTier = 'dedicated-high';
                    $defaultRam = 36;
                    $defaultStorage = 1024;
                } elseif ($variant === 'pro') {
                    $cpuName = "Apple M{$gen} Pro";
                    $cpuTier = 'high';
                    $gpu = 'Apple '.($gen >= 3 ? 18 : 16).'-core GPU';
                    $gpuTier = 'integrated';
                    $defaultRam = 18;
                    $defaultStorage = 512;
                } else {
                    $cpuName = "Apple M{$gen}";
                    $cpuTier = $gen >= 4 ? 'high' : 'mid';
                    $gpu = 'Apple 10-core GPU';
                    $gpuTier = 'integrated';
                    $defaultRam = 16;
                    $defaultStorage = 512;
                }

                $inferredYear = match ($gen) {
                    1 => 2020,
                    2 => 2022,
                    3 => 2023,
                    4 => 2024,
                    5 => 2025,
                    default => (int) date('Y'),
                };
            } elseif (str_contains($lower, 'macbook pro')) {
                $isMax = str_contains($lower, 'max');
                $cpuName = $isMax ? 'Apple M3 Max' : 'Apple M3 Pro';
                $cpuTier = 'high';
                $gpu = $isMax ? 'Apple 40-core GPU' : 'Apple 18-core GPU';
                $gpuTier = $isMax ? 'dedicated-high' : 'integrated';
                $defaultRam = $isMax ? 36 : 18;
                $defaultStorage = 512;
                $inferredYear = 2023;
            } elseif (str_contains($lower, 'macbook air')) {
                $cpuName = 'Apple M3';
                $cpuTier = 'mid';
                $gpu = 'Apple 10-core GPU';
                $gpuTier = 'integrated';
                $defaultRam = 16;
                $defaultStorage = 512;
                $inferredYear = 2024;
            } elseif (str_contains($lower, 'mac mini') || str_contains($lower, 'mini')) {
                $cpuName = 'Apple M4';
                $cpuTier = 'high';
                $gpu = 'Apple 10-core GPU';
                $gpuTier = 'integrated';
                $defaultRam = 16;
                $defaultStorage = 512;
                $inferredYear = 2024;
            } elseif (str_contains($lower, 'studio')) {
                $cpuName = 'Apple M2 Max';
                $cpuTier = 'high';
                $gpu = 'Apple 30-core GPU';
                $gpuTier = 'dedicated-high';
                $defaultRam = 32;
                $defaultStorage = 512;
                $inferredYear = 2023;
            } elseif (str_contains($lower, 'mac pro')) {
                $cpuName = 'Apple M2 Ultra';
                $cpuTier = 'workstation';
                $gpu = 'Apple 60-core GPU';
                $gpuTier = 'dedicated-high';
                $defaultRam = 64;
                $defaultStorage = 1024;
                $inferredYear = 2023;
            } else {
                $cpuName = 'Apple M3';
                $cpuTier = 'mid';
                $gpu = 'Apple 10-core GPU';
                $gpuTier = 'integrated';
                $defaultRam = 16;
                $defaultStorage = 512;
                $inferredYear = 2024;
            }
        } else {
            $isWorkstation = str_contains($lower, 'xeon') || str_contains($lower, 'threadripper') || str_contains($lower, 'epyc');
            $isDedicatedHigh = str_contains($lower, 'rtx 40') || str_contains($lower, 'rtx 3080') || str_contains($lower, 'rtx 3090') || str_contains($lower, 'ada') || str_contains($lower, 'quadro');
            $isDedicatedEntry = str_contains($lower, 'gtx') || str_contains($lower, 'rtx 3050') || str_contains($lower, 'rtx 4050') || str_contains($lower, 'radeon rx');

            $isSnapdragon = str_contains($lower, 'snapdragon')
                || str_contains($lower, 'x elite')
                || str_contains($lower, 'x plus')
                || str_contains($lower, 'copilot+')
                || str_contains($lower, 'copilot plus');

            $isChromebook = str_contains($lower, 'chromebook')
                || str_contains($lower, 'chrome os')
                || str_contains($lower, 'chromeos')
                || str_contains($lower, 'kompanio');

            if ($isWorkstation) {
                $cpuTier = 'workstation';
                $cpuName = str_contains($lower, 'threadripper') ? 'AMD Ryzen Threadripper PRO 7995WX' : (str_contains($lower, 'epyc') ? 'AMD EPYC 9004' : 'Intel Xeon W-2400');
                $defaultRam = 64;
                $defaultStorage = 1024;
            } elseif ($isSnapdragon) {
                if (str_contains($lower, 'x plus')) {
                    $cpuName = 'Qualcomm Snapdragon X Plus X1P-64-100';
                    $cpuTier = 'mid';
                    $gpu = 'Qualcomm Adreno GPU';
                } else {
                    $cpuName = 'Qualcomm Snapdragon X Elite X1E-80-100';
                    $cpuTier = 'high';
                    $gpu = 'Qualcomm Adreno X1-85 GPU';
                }
                $gpuTier = 'integrated';
                $defaultRam = 16;
                $defaultStorage = 512;
                $inferredYear = 2024;
            } elseif ($isChromebook) {
                if (str_contains($lower, 'plus') || str_contains($lower, 'core')) {
                    $cpuName = 'Intel Core i3-1215U';
                    $cpuTier = 'mid';
                    $gpu = 'Intel UHD Graphics';
                    $defaultRam = 8;
                    $defaultStorage = 256;
                } elseif (str_contains($lower, 'kompanio')) {
                    $cpuName = 'MediaTek Kompanio 520';
                    $cpuTier = 'entry';
                    $gpu = 'ARM Mali-G52 MC2';
                    $defaultRam = 8;
                    $defaultStorage = 128;
                } else {
                    $cpuName = 'Intel Processor N100';
                    $cpuTier = 'entry';
                    $gpu = 'Intel UHD Graphics';
                    $defaultRam = 8;
                    $defaultStorage = 128;
                }
                $gpuTier = 'integrated';
                $inferredYear = 2024;
            } elseif (preg_match('/\bryzen\s*ai\s*([3579]|hx\s*370|365)?\b/i', $input) || str_contains($lower, 'ryzen ai')) {
                $cpuTier = 'high';
                $cpuName = 'AMD Ryzen AI 9 HX 370';
                $gpu = 'AMD Radeon 890M';
                $gpuTier = 'integrated';
                $defaultRam = 32;
                $defaultStorage = 1024;
                $inferredYear = 2024;
            } elseif (preg_match('/\bcore\s+ultra\s+([579])(?:\s*(\d{3}[A-Z]*))?\b/i', $input, $uMatch) || str_contains($lower, 'lunar lake') || str_contains($lower, 'meteor lake')) {
                $uNum = isset($uMatch[1]) ? (int) $uMatch[1] : 7;
                $sku = $uMatch[2] ?? '';
                $isLunarLake = str_contains($lower, 'lunar lake') || (strlen($sku) >= 3 && str_starts_with($sku, '2'));

                if ($isLunarLake) {
                    $cpuName = ! empty($sku) ? "Intel Core Ultra {$uNum} {$sku}" : ($uNum === 9 ? 'Intel Core Ultra 9 288V' : 'Intel Core Ultra 7 258V');
                    $cpuTier = $uNum === 5 ? 'mid' : 'high';
                    $gpu = 'Intel Arc 140V GPU';
                    $gpuTier = 'integrated';
                    $defaultRam = 32;
                    $defaultStorage = 1024;
                } else {
                    $cpuTier = $uNum === 5 ? 'mid' : 'high';
                    $cpuName = match ($uNum) {
                        9 => 'Intel Core Ultra 9 185H',
                        7 => 'Intel Core Ultra 7 155H',
                        default => 'Intel Core Ultra 5 125H',
                    };
                    $gpu = 'Intel Arc Graphics';
                    $gpuTier = 'integrated';
                    $defaultRam = $uNum >= 7 ? 32 : 16;
                    $defaultStorage = 512;
                }
                $inferredYear = 2024;
            } elseif (preg_match('/\b(?:core\s+)?i([3579])(?:-|\s*)(\d{4,5}[A-Z]*)?\b/i', $input, $iMatch)) {
                $iNum = (int) $iMatch[1];
                if ($iNum === 9) {
                    $cpuTier = 'high';
                    $cpuName = 'Intel Core i9-14900HX';
                    $defaultRam = 32;
                } elseif ($iNum === 7) {
                    $cpuTier = 'high';
                    $cpuName = 'Intel Core i7-13700H';
                    $defaultRam = 16;
                } elseif ($iNum === 5) {
                    $cpuTier = 'mid';
                    $cpuName = 'Intel Core i5-1335U';
                    $defaultRam = 16;
                } else {
                    $cpuTier = 'entry';
                    $cpuName = 'Intel Core i3-1215U';
                    $defaultRam = 8;
                    $defaultStorage = 256;
                }
            } elseif (preg_match('/\bryzen\s*(?:ai\s*)?([3579])\b/i', $input, $rMatch)) {
                $rNum = (int) $rMatch[1];
                if ($rNum === 9) {
                    $cpuTier = 'high';
                    $cpuName = 'AMD Ryzen 9 7940HS';
                    $defaultRam = 32;
                } elseif ($rNum === 7) {
                    $cpuTier = 'high';
                    $cpuName = 'AMD Ryzen 7 7840U';
                    $defaultRam = 16;
                } elseif ($rNum === 5) {
                    $cpuTier = 'mid';
                    $cpuName = 'AMD Ryzen 5 7530U';
                    $defaultRam = 16;
                } else {
                    $cpuTier = 'entry';
                    $cpuName = 'AMD Ryzen 3 7320U';
                    $defaultRam = 8;
                    $defaultStorage = 256;
                }
            }

            if ($gpu === 'Integrated Graphics') {
                if ($isDedicatedHigh) {
                    $gpu = 'NVIDIA RTX 4070';
                    $gpuTier = 'dedicated-high';
                } elseif ($isDedicatedEntry) {
                    $gpu = 'NVIDIA RTX 3050';
                    $gpuTier = 'dedicated-entry';
                } else {
                    $gpu = $cpuTier === 'entry' ? 'Intel UHD Graphics' : 'Intel Iris Xe Graphics';
                    $gpuTier = 'integrated';
                }
            }
        }

        $ram = $defaultRam;
        if (preg_match('/(\d+)\s*(?:gb|g)?\s*(?:ram|memory)/i', $input, $m)) {
            $ram = (int) $m[1];
        } elseif (preg_match('/\b(8|16|18|24|32|36|48|64|128)\s*(?:gb)?\b/i', $input, $m)) {
            $ram = (int) $m[1];
        }

        $storage = $defaultStorage;
        if (preg_match('/(\d+)\s*(?:gb|tb)\s*(?:ssd|hdd|nvme|storage|drive)/i', $input, $m)) {
            $val = (int) $m[1];
            if (str_contains(strtolower($m[0]), 'tb')) {
                $storage = $val * 1024;
            } elseif ($val >= 128) {
                $storage = $val;
            }
        } elseif (preg_match('/\b(128|256|512|1024|2048)\s*(?:gb)?\b/i', $input, $m)) {
            $storage = (int) $m[1];
        } elseif (preg_match('/\b(1|2|4)\s*tb\b/i', $input, $m)) {
            $storage = ((int) $m[1]) * 1024;
        }
        $storageType = str_contains($lower, 'hdd') ? 'HDD' : 'SSD';

        $year = $inferredYear;
        if (preg_match('/\b(201\d|202\d)\b/', $input, $m)) {
            $year = (int) $m[1];
        }

        $model = preg_replace('/^'.preg_quote($brand, '/').'\s+/i', '', $clean);
        if (empty($model)) {
            $model = $clean;
        }

        $imageUrl = HardwareImageService::resolvePublicAssetImage($brand, $model, $deviceType);

        return [
            'brand' => $brand,
            'model' => $model,
            'device_type' => $deviceType,
            'cpu' => $cpuName,
            'cpu_tier' => $cpuTier,
            'ram_gb' => max(4, min(512, $ram)),
            'storage_type' => $storageType,
            'storage_gb' => max(128, min(16384, $storage)),
            'gpu' => $gpu,
            'gpu_tier' => $gpuTier,
            'year_acquired' => $year,
            'image_url' => $imageUrl,
        ];
    }

    /**
     * Sanitize and validate structured device spec output returned by Gemini.
     *
     * @param  array<string, mixed>  $data
     * @return array{
     *     brand: string,
     *     model: string,
     *     device_type: string,
     *     cpu: string,
     *     cpu_tier: string,
     *     ram_gb: int,
     *     storage_type: string,
     *     storage_gb: int,
     *     gpu: string,
     *     gpu_tier: string,
     *     year_acquired: int,
     *     image_url: ?string
     * }
     */
    public function sanitize(array $data, ?string $originalQuery = null): array
    {
        $validCpuTiers = ['entry', 'mid', 'high', 'workstation'];
        $validGpuTiers = ['none', 'integrated', 'dedicated-entry', 'dedicated-high'];
        $validDeviceTypes = ['laptop', 'desktop'];
        $validStorageTypes = ['SSD', 'HDD'];

        $brand = mb_substr(trim((string) ($data['brand'] ?? '')), 0, 100) ?: 'Unknown';
        $model = mb_substr(trim((string) ($data['model'] ?? '')), 0, 100) ?: 'Unknown Model';
        $deviceType = in_array($data['device_type'] ?? '', $validDeviceTypes, true) ? (string) $data['device_type'] : 'laptop';
        $cpu = mb_substr(trim((string) ($data['cpu'] ?? '')), 0, 150);

        $lowerModel = strtolower($model);
        $lowerQuery = strtolower($originalQuery ?? '');

        if (
            strcasecmp($brand, 'Apple') === 0
            || str_contains($lowerModel, 'macbook')
            || str_contains($lowerModel, 'mac mini')
            || str_contains($lowerModel, 'mac studio')
            || str_contains($lowerModel, 'mac pro')
            || str_contains($lowerModel, 'imac')
        ) {
            $brand = 'Apple';
            if (
                str_contains($lowerModel, 'mac mini')
                || str_contains($lowerModel, 'mac studio')
                || str_contains($lowerModel, 'mac pro')
                || str_contains($lowerModel, 'imac')
            ) {
                $deviceType = 'desktop';
            }

            if ($cpu === '' || str_contains(strtolower($cpu), 'intel') || str_contains(strtolower($cpu), 'generic') || str_contains(strtolower($cpu), 'amd')) {
                if (preg_match('/m([1-9])/i', $model.' '.($originalQuery ?? ''), $m)) {
                    $cpu = "Apple M{$m[1]}";
                } elseif (str_contains($lowerModel, 'mac mini')) {
                    $cpu = 'Apple M4';
                } else {
                    $cpu = 'Apple M3';
                }
            }
        } elseif (
            str_contains(strtolower($cpu), 'snapdragon')
            || str_contains(strtolower($cpu), 'qualcomm')
            || str_contains($lowerQuery, 'snapdragon')
            || str_contains($lowerQuery, 'x elite')
        ) {
            if ($cpu === '' || str_contains(strtolower($cpu), 'generic')) {
                $cpu = 'Qualcomm Snapdragon X Elite X1E-80-100';
            }
            if (empty($data['cpu_tier']) || $data['cpu_tier'] === 'entry') {
                $data['cpu_tier'] = str_contains(strtolower($cpu), 'x plus') ? 'mid' : 'high';
            }
            if (empty($data['gpu']) || $data['gpu'] === 'Integrated Graphics') {
                $data['gpu'] = 'Qualcomm Adreno X1-85 GPU';
            }
        } elseif (str_contains($lowerModel, 'chromebook') || str_contains($lowerQuery, 'chromebook')) {
            if ($cpu === '' || str_contains(strtolower($cpu), 'generic')) {
                $cpu = 'Intel Processor N100';
            }
        } elseif ($cpu === '' || str_contains(strtolower($cpu), 'generic')) {
            $cpu = 'Intel Core i5-1335U';
        }

        $cpuTier = in_array($data['cpu_tier'] ?? '', $validCpuTiers, true) ? (string) $data['cpu_tier'] : 'mid';
        if (($brand === 'Apple' || str_contains(strtolower($cpu), 'snapdragon x elite')) && $cpuTier === 'entry') {
            $cpuTier = 'high';
        }

        $ramGb = max(4, min(512, (int) ($data['ram_gb'] ?? 16)));
        $rawStorageType = strtoupper((string) ($data['storage_type'] ?? ''));
        $storageType = in_array($rawStorageType, $validStorageTypes, true) ? $rawStorageType : 'SSD';
        $storageGb = max(64, min(16384, (int) ($data['storage_gb'] ?? 512)));
        $gpu = mb_substr(trim((string) ($data['gpu'] ?? '')), 0, 150) ?: 'Integrated Graphics';
        $gpuTier = in_array($data['gpu_tier'] ?? '', $validGpuTiers, true) ? (string) $data['gpu_tier'] : 'integrated';
        $yearAcquired = max(2010, min((int) date('Y') + 1, (int) ($data['year_acquired'] ?? date('Y'))));

        $imageUrl = HardwareImageService::resolvePublicAssetImage($brand, $model, $deviceType);

        return [
            'brand' => $brand,
            'model' => $model,
            'device_type' => $deviceType,
            'cpu' => $cpu,
            'cpu_tier' => $cpuTier,
            'ram_gb' => $ramGb,
            'storage_type' => $storageType,
            'storage_gb' => $storageGb,
            'gpu' => $gpu,
            'gpu_tier' => $gpuTier,
            'year_acquired' => $yearAcquired,
            'image_url' => $imageUrl,
        ];
    }
}
