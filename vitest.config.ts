import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		environment: 'node',
		setupFiles: ['./__tests__/setup.ts'],
		include: ['__tests__/**/*.test.{ts,tsx}', '__tests__/**/*.vitest.{ts,tsx}'],
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
});
