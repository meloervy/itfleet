export const matchCpuTierOptions = [
    { value: 'entry', label: 'Entry' },
    { value: 'mid', label: 'Mid' },
    { value: 'high', label: 'High' },
    { value: 'workstation', label: 'Workstation' },
];

export const matchGpuTierOptions = [
    { value: 'none', label: 'None' },
    { value: 'integrated', label: 'Integrated' },
    { value: 'dedicated-entry', label: 'Dedicated Entry' },
    { value: 'dedicated-high', label: 'Dedicated High' },
];

export const DEFAULT_TEMPLATES = [
    {
        id: 'tpl-video-editor',
        title: 'Senior 4K Video Editor',
        category: 'Creative & Media',
        specs_summary: 'Core i7/M3 Pro • 32GB RAM • Dedicated High GPU • Laptop',
        prompt: 'New senior video editor joining marketing. Needs to edit 4K footage in Premiere/After Effects and travels frequently between shoots.',
        isCustom: false,
    },
    {
        id: 'tpl-backend-eng',
        title: 'Backend Software Engineer',
        category: 'Engineering & Dev',
        specs_summary: 'Core i7 / Ryzen 7 • 32GB RAM • 1TB SSD • Laptop',
        prompt: 'Backend software engineer working with Docker microservices, compiling Rust and running local databases. Needs 32GB RAM and portability.',
        isCustom: false,
    },
    {
        id: 'tpl-data-analyst',
        title: 'Senior Data & BI Analyst',
        category: 'Analytics',
        specs_summary: 'Core i5/i7 • 16GB RAM • 512GB SSD • Desktop OK',
        prompt: 'Data analyst doing heavy SQL querying and Tableau visualization from office desk. No GPU needed, prefers desktop.',
        isCustom: false,
    },
    {
        id: 'tpl-hr-specialist',
        title: 'HR & Administrative Specialist',
        category: 'Office & Ops',
        specs_summary: 'Entry CPU • 8GB RAM • 256GB SSD • Laptop',
        prompt: 'HR specialist handling spreadsheets, web apps, and emails. Basic productivity laptop.',
        isCustom: false,
    },
    {
        id: 'tpl-ai-researcher',
        title: 'AI / 3D Simulation Engineer',
        category: 'Engineering & Dev',
        specs_summary: 'Workstation Xeon/Threadripper • 64GB RAM • Dedicated High GPU',
        prompt: 'Machine learning specialist training local PyTorch models and running 3D viewport simulations. Demands workstation class CPU and high-end discrete GPU.',
        isCustom: false,
    },
];
