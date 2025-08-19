import { beforeAll, vi } from 'vitest';
import '@testing-library/jest-dom';

// Setup global test environment
beforeAll(() => {
	// Mock environment variables for testing
	vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
	vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
	vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
	vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key');
	vi.stubEnv('PUBLIC_APP_URL', 'http://localhost:5173');
	
	// Force browser environment
	Object.defineProperty(globalThis, 'document', {
		value: global.document,
		writable: true
	});
	
	Object.defineProperty(globalThis, 'window', {
		value: global.window,
		writable: true
	});
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock crypto.randomUUID for consistent testing
Object.defineProperty(global, 'crypto', {
	value: {
		randomUUID: () => 'test-uuid-1234'
	}
});

// Mock clipboard API
if (!navigator.clipboard) {
	Object.defineProperty(navigator, 'clipboard', {
		value: {
			writeText: vi.fn().mockResolvedValue(undefined),
			readText: vi.fn().mockResolvedValue('')
		},
		writable: true
	});
}

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
	observe: vi.fn(),
	disconnect: vi.fn(),
	unobserve: vi.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
	observe: vi.fn(),
	disconnect: vi.fn(),
	unobserve: vi.fn()
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
	setTimeout(callback, 16);
	return 1;
});

// Mock cancelAnimationFrame
global.cancelAnimationFrame = vi.fn();

