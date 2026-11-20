export const deviceTypeOptions = [
    { value: 'laptop', label: 'Laptop (Mobile Workstation / Portable)' },
    { value: 'desktop', label: 'Desktop / Workstation (Stationary)' },
    { value: 'monitor', label: 'Monitor / External Display' },
    { value: 'mobile', label: 'Mobile Device (Phone / Tablet)' },
    { value: 'peripheral', label: 'Peripheral (Dock / Headset / Accessory)' },
];

export const cpuTierOptions = [
    { value: 'entry', label: 'Entry (Celeron, Core i3, older quad-core, Intel N-series)' },
    { value: 'mid', label: 'Mid (Core i5, Ryzen 5, Apple base, Snapdragon X Plus, Core Ultra 5)' },
    { value: 'high', label: 'High (Core i7/i9, Core Ultra 7/9, Ryzen 7/9, Ryzen AI, Snapdragon X Elite, M3/M4)' },
    { value: 'workstation', label: 'Workstation (Xeon, Threadripper, M-series Ultra)' },
];

export const storageTypeOptions = [
    { value: 'SSD', label: 'SSD (NVMe / Solid State)' },
    { value: 'HDD', label: 'HDD (Mechanical Hard Drive)' },
];

export const gpuTierOptions = [
    { value: 'none', label: 'None' },
    { value: 'integrated', label: 'Integrated (Intel UHD/Iris/Arc, Snapdragon Adreno, Apple GPU, Radeon 890M)' },
    { value: 'dedicated-entry', label: 'Dedicated Entry (GTX 1650, RTX 3050)' },
    { value: 'dedicated-high', label: 'Dedicated High (RTX 4070+, Ada, A-series, Apple Max/Ultra)' },
];

export const lifecycleStageOptions = [
    { value: 'acquisition', label: 'Acquisition (Procured / Staging / Intake)' },
    { value: 'deployment', label: 'Deployment (Active In-Service)' },
    { value: 'maintenance', label: 'Maintenance (Servicing / In-Repair)' },
    { value: 'retirement', label: 'Retirement (Decommissioned / Recycled)' },
];

export const conditionOptions = [
    { value: 'excellent', label: 'Excellent (Like New / Minimal Wear)' },
    { value: 'good', label: 'Good (Normal Operational Wear)' },
    { value: 'fair', label: 'Fair (Noticeable Scratches / Moderate Wear)' },
    { value: 'needs_repair', label: 'Needs Repair (Degraded Hardware)' },
    { value: 'retired', label: 'Retired (Decommissioned)' },
];

export const statusOptions = [
    { value: 'available', label: 'Available (Pool Stockroom)' },
    { value: 'assigned', label: 'Assigned to Staff' },
    { value: 'in_repair', label: 'Under Servicing / In Repair' },
    { value: 'retired', label: 'Retired / Archived' },
];

export const supportedBrands = [
    'Apple', 'Dell', 'Lenovo', 'HP', 'ASUS', 'Acer', 'Microsoft', 'Samsung',
    'Google', 'Framework', 'MSI', 'Minisforum', 'Beelink', 'Razer', 'Gigabyte', 'Intel', 'LG',
];

export const supportedModels = [
    'Surface Laptop 7 Copilot+ PC',
    'Surface Pro 11 Copilot+ PC',
    'ThinkPad T14s Gen 6 Snapdragon',
    'XPS 13 9345 Snapdragon',
    'OmniBook X 14 Snapdragon',
    'Vivobook S 15 OLED Snapdragon',
    'Swift 14 AI Snapdragon',
    'Galaxy Book4 Edge',
    'Chromebook Spin 714',
    'Chromebook Plus 515',
    'Chromebook Plus CX34',
    'Chromebook x360 14',
    'IdeaPad Slim 3 Chromebook',
    'Galaxy Chromebook 2',
    'ThinkPad X1 Carbon Gen 12',
    'ThinkPad T14 Gen 5',
    'XPS 14 9440 Core Ultra',
    'XPS 16 9640 Core Ultra',
    'Zenbook S 14 Lunar Lake',
    'Zenbook S 16 Ryzen AI',
    'OmniBook Ultra Ryzen AI',
    'EliteBook 840 G10',
    'MacBook Pro 16 M4 Pro',
    'MacBook Pro 14 M4',
    'MacBook Air 15 M3',
    'MacBook Air 13 M3',
    'Mac mini M4 Desktop',
    'Mac Studio M2 Max',
    'ThinkCentre M70q Tiny',
    'OptiPlex Micro Plus',
    'Pro Mini 400 G9',
    'EliteMini UM780 XTX',
    'Precision 7875 Workstation',
];

export const supportedCpus = [
    'Qualcomm Snapdragon X Elite X1E-84-100',
    'Qualcomm Snapdragon X Elite X1E-80-100',
    'Qualcomm Snapdragon X Elite X1E-78-100',
    'Qualcomm Snapdragon X Plus X1P-64-100',
    'Intel Core Ultra 9 288V',
    'Intel Core Ultra 7 258V',
    'Intel Core Ultra 7 155H',
    'Intel Core Ultra 5 125H',
    'Intel Core i9-14900HX',
    'Intel Core i7-13700H',
    'Intel Core i5-1335U',
    'Intel Core i3-1215U',
    'Intel Processor N100',
    'Intel Processor N200',
    'MediaTek Kompanio 520',
    'AMD Ryzen AI 9 HX 370',
    'AMD Ryzen AI 9 365',
    'AMD Ryzen 7 8840U',
    'AMD Ryzen 7 7840U',
    'AMD Ryzen 5 7530U',
    'AMD Ryzen Threadripper PRO 7995WX',
    'Apple M4 Pro',
    'Apple M4 Max',
    'Apple M4',
    'Apple M3 Max',
    'Apple M3 Pro',
    'Apple M3',
    'Apple M2 Ultra',
];

export const architectureQuickChips = [
    {
        id: 'snapdragon',
        name: 'Snapdragon Copilot+',
        chips: [
            { label: 'Surface Laptop 7 (Snapdragon X Elite)', query: 'Surface Laptop 7 Snapdragon X Elite 32GB' },
            { label: 'ThinkPad T14s Gen 6 Snapdragon', query: 'ThinkPad T14s Gen 6 Snapdragon X Elite 32GB' },
            { label: 'Dell XPS 13 9345 (Snapdragon)', query: 'Dell XPS 13 9345 Snapdragon X Elite 16GB' },
            { label: 'ASUS Vivobook S 15 OLED', query: 'ASUS Vivobook S 15 OLED Snapdragon X Plus 16GB' },
            { label: 'HP OmniBook X 14', query: 'HP OmniBook X 14 Snapdragon X Elite 16GB' },
        ],
    },
    {
        id: 'chromebook',
        name: 'Chromebooks',
        chips: [
            { label: 'Acer Chromebook Spin 714', query: 'Acer Chromebook Spin 714 Intel N100 8GB' },
            { label: 'HP Chromebook x360 14', query: 'HP Chromebook x360 Intel N100 8GB' },
            { label: 'Lenovo IdeaPad Slim 3 Chromebook', query: 'Lenovo IdeaPad Slim 3 Chromebook 8GB' },
            { label: 'ASUS Chromebook Plus CX34', query: 'ASUS Chromebook Plus CX34 Intel Core i3 8GB' },
            { label: 'Samsung Galaxy Chromebook 2', query: 'Samsung Galaxy Chromebook 2 Intel Celeron 8GB' },
        ],
    },
    {
        id: 'apple',
        name: 'Apple Silicon',
        chips: [
            { label: 'MacBook Pro 16 (M4 Pro)', query: 'MacBook Pro 16 M4 Pro 36GB SSD' },
            { label: 'MacBook Air 15 (M3)', query: 'MacBook Air 15 M3 16GB 512GB' },
            { label: 'Mac mini M4 Desktop', query: 'Apple Mac mini M4 16GB 512GB SSD' },
            { label: 'Mac Studio M2 Max', query: 'Apple Mac Studio M2 Max 32GB' },
        ],
    },
    {
        id: 'intel_ultra',
        name: 'Core Ultra',
        chips: [
            { label: 'ThinkPad X1 Carbon Gen 12', query: 'ThinkPad X1 Carbon Intel Core Ultra 7 155H 32GB' },
            { label: 'Dell XPS 14 Core Ultra 7', query: 'Dell XPS 14 Intel Core Ultra 7 32GB SSD' },
            { label: 'ASUS Zenbook S 14 (Lunar Lake)', query: 'ASUS Zenbook S 14 Intel Core Ultra 7 258V 32GB' },
        ],
    },
    {
        id: 'ryzen_ai',
        name: 'Ryzen AI & Workstations',
        chips: [
            { label: 'ASUS Zenbook S 16 Ryzen AI 9', query: 'ASUS Zenbook S 16 AMD Ryzen AI 9 HX 370 32GB' },
            { label: 'HP OmniBook Ultra Ryzen AI', query: 'HP OmniBook Ultra AMD Ryzen AI 9 32GB' },
            { label: 'Dell Precision 7875 AI Workstation', query: 'Dell Precision 7875 AMD Threadripper 64GB Workstation' },
            { label: 'Lenovo ThinkCentre M70q Tiny', query: 'Lenovo ThinkCentre M70q Tiny Intel Core i5 16GB Desktop' },
        ],
    },
];

export const fullHardwareTemplates = [
    {
        title: 'Copilot+ AI Laptop',
        subtitle: 'Snapdragon X Elite · 32GB RAM · 1TB SSD',
        badge: 'ARM64 Copilot+',
        data: {
            brand: 'Microsoft',
            model: 'Surface Laptop 7 Copilot+ PC',
            device_type: 'laptop',
            cpu: 'Qualcomm Snapdragon X Elite X1E-80-100',
            cpu_tier: 'high',
            ram_gb: 32,
            storage_type: 'SSD',
            storage_gb: 1024,
            gpu: 'Qualcomm Adreno X1-85 GPU',
            gpu_tier: 'integrated',
            vendor: 'Microsoft Direct',
            purchase_cost: '94990.00',
            image_url: '/images/devices/default-laptop.jpg',
        },
    },
    {
        title: 'Cloud Fleet Chromebook',
        subtitle: 'Intel N100 · 8GB RAM · 128GB SSD',
        badge: 'ChromeOS Cloud',
        data: {
            brand: 'Acer',
            model: 'Chromebook Spin 714',
            device_type: 'laptop',
            cpu: 'Intel Processor N100',
            cpu_tier: 'entry',
            ram_gb: 8,
            storage_type: 'SSD',
            storage_gb: 128,
            gpu: 'Intel UHD Graphics',
            gpu_tier: 'integrated',
            vendor: 'Acer Commercial',
            purchase_cost: '24999.00',
            image_url: '/images/devices/acer-aspire.jpg',
        },
    },
    {
        title: 'Executive Ultraportable',
        subtitle: 'Core Ultra 7 · 32GB RAM · 1TB SSD',
        badge: 'Intel AI Boost',
        data: {
            brand: 'Lenovo',
            model: 'ThinkPad X1 Carbon Gen 12',
            device_type: 'laptop',
            cpu: 'Intel Core Ultra 7 155H',
            cpu_tier: 'high',
            ram_gb: 32,
            storage_type: 'SSD',
            storage_gb: 1024,
            gpu: 'Intel Arc Graphics',
            gpu_tier: 'integrated',
            vendor: 'Lenovo Premier',
            purchase_cost: '115000.00',
            image_url: '/images/devices/lenovo-thinkpad-x1.jpg',
        },
    },
    {
        title: 'Apple Engineering Workhorse',
        subtitle: 'MacBook Pro 16 · M4 Pro · 36GB RAM',
        badge: 'Apple Silicon',
        data: {
            brand: 'Apple',
            model: 'MacBook Pro 16',
            device_type: 'laptop',
            cpu: 'Apple M4 Pro',
            cpu_tier: 'high',
            ram_gb: 36,
            storage_type: 'SSD',
            storage_gb: 1024,
            gpu: 'Apple 18-core GPU',
            gpu_tier: 'integrated',
            vendor: 'Apple Enterprise',
            purchase_cost: '149990.00',
            image_url: '/images/devices/apple-macbook-pro.jpg',
        },
    },
    {
        title: 'Compact Desk Node',
        subtitle: 'Apple Mac mini M4 · 16GB RAM · Desktop',
        badge: 'Mini PC Desktop',
        data: {
            brand: 'Apple',
            model: 'Mac mini M4',
            device_type: 'desktop',
            cpu: 'Apple M4',
            cpu_tier: 'high',
            ram_gb: 16,
            storage_type: 'SSD',
            storage_gb: 512,
            gpu: 'Apple 10-core GPU',
            gpu_tier: 'integrated',
            vendor: 'Apple Enterprise',
            purchase_cost: '44990.00',
            image_url: '/images/devices/default-desktop.jpg',
        },
    },
    {
        title: 'Enterprise Tiny Desktop',
        subtitle: 'ThinkCentre M70q Tiny · Core i5 · 16GB',
        badge: 'Micro Desktop',
        data: {
            brand: 'Lenovo',
            model: 'ThinkCentre M70q Tiny',
            device_type: 'desktop',
            cpu: 'Intel Core i5-13500T',
            cpu_tier: 'mid',
            ram_gb: 16,
            storage_type: 'SSD',
            storage_gb: 512,
            gpu: 'Intel UHD Graphics 770',
            gpu_tier: 'integrated',
            vendor: 'Lenovo Enterprise',
            purchase_cost: '48000.00',
            image_url: '/images/devices/lenovo-thinkcentre.jpg',
        },
    },
];

export const getDetectedArchitectureInfo = (deviceData) => {
    const text = `${deviceData.brand || ''} ${deviceData.model || ''} ${deviceData.cpu || ''}`.toLowerCase();

    if (text.includes('snapdragon') || text.includes('x elite') || text.includes('x plus') || text.includes('copilot+')) {
        return {
            archLabel: 'ARM64 (Qualcomm Snapdragon)',
            badgeColor: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
            npu: '45 TOPS Hexagon NPU',
            aiCertified: 'Copilot+ PC Certified',
        };
    }
    if (text.includes('apple') || text.includes('macbook') || text.includes('mac mini') || text.includes('mac studio') || text.includes('m1') || text.includes('m2') || text.includes('m3') || text.includes('m4') || text.includes('m5')) {
        return {
            archLabel: 'ARM64 (Apple Silicon)',
            badgeColor: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
            npu: '16-Core Neural Engine (38 TOPS)',
            aiCertified: 'Apple Intelligence Ready',
        };
    }
    if (text.includes('chromebook') || text.includes('chromeos') || text.includes('kompanio') || text.includes('n100') || text.includes('n200')) {
        return {
            archLabel: 'Cloud Endpoint (ChromeOS)',
            badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
            npu: 'Cloud-Grounded AI',
            aiCertified: 'Chromebook Plus Ready',
        };
    }
    if (text.includes('core ultra') || text.includes('lunar lake') || text.includes('meteor lake')) {
        return {
            archLabel: 'x86_64 (Intel Core Ultra)',
            badgeColor: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
            npu: 'Intel AI Boost NPU (47 TOPS)',
            aiCertified: 'Copilot+ / Intel AI Ready',
        };
    }
    if (text.includes('ryzen ai') || text.includes('hx 370') || text.includes('365')) {
        return {
            archLabel: 'x86_64 (AMD Ryzen AI 300)',
            badgeColor: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
            npu: 'AMD XDNA 2 NPU (50 TOPS)',
            aiCertified: 'Copilot+ / Ryzen AI Ready',
        };
    }
    return {
        archLabel: 'x86_64 Standard Architecture',
        badgeColor: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
        npu: 'Standard Compute',
        aiCertified: 'Enterprise Standard',
    };
};

export const calculateWorkloadFit = (deviceData) => {
    const ram = Number(deviceData.ram_gb) || 0;
    const cpuTier = deviceData.cpu_tier || 'mid';
    const gpuTier = deviceData.gpu_tier || 'none';
    const storage = Number(deviceData.storage_gb) || 0;

    let dev = 50;
    if (ram >= 32) dev += 30;
    else if (ram >= 16) dev += 20;
    else if (ram >= 8) dev += 5;
    if (['high', 'workstation'].includes(cpuTier)) dev += 20;
    else if (cpuTier === 'mid') dev += 10;
    if (storage >= 512) dev += 10;
    dev = Math.min(100, dev);

    let design = 35;
    if (['dedicated-high', 'dedicated-entry'].includes(gpuTier)) design += 40;
    else if (gpuTier === 'integrated') design += 20;
    if (ram >= 32) design += 25;
    else if (ram >= 16) design += 15;
    design = Math.min(100, design);

    let admin = 65;
    if (ram >= 8) admin += 25;
    if (storage >= 256) admin += 10;
    admin = Math.min(100, admin);

    return { dev, design, admin };
};
