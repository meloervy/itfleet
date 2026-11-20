import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const isBuildWatch = process.argv.includes('--watch');

export default defineConfig({
    plugins: [
        laravel({
            input: 'resources/js/app.jsx',
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    build: isBuildWatch
        ? {
              watch: {
                  include: ['resources/**'],
                  exclude: [
                      '**/node_modules/**',
                      '**/vendor/**',
                      '**/storage/**',
                      '**/public/**',
                      '**/database/**',
                      '**/.git/**',
                  ],
              },
          }
        : undefined,
    server: {
        host: '127.0.0.1',
        cors: true,
        hmr: {
            host: 'localhost',
        },
        watch: {
            ignored: [
                '**/vendor/**',
                '**/storage/**',
                '**/node_modules/**',
                '**/.git/**',
            ],
        },
    },
});
