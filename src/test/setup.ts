import { beforeAll, vi } from 'vitest';

// Setup global test environment
beforeAll(() => {
	// Mock environment variables for testing
	vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
	vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
	vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
	vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key');
	vi.stubEnv('PUBLIC_APP_URL', 'http://localhost:5173');
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock crypto.randomUUID for consistent testing
Object.defineProperty(global, 'crypto', {
	value: {
		randomUUID: () => 'test-uuid-1234'
	}
});

