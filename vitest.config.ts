import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'happy-dom',
		setupFiles: ['./src/test/setup.ts'],
		globals: true,
		pool: 'forks',
		poolOptions: {
			forks: {
				singleFork: true
			}
		}
	},
	define: {
		// Force browser mode for all tests
		'import.meta.env.SSR': false,
		'process.env.NODE_ENV': '"test"'
	},
	resolve: {
		conditions: ['browser']
	}
});
