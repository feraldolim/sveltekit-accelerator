import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './+server.js';

// Mock dependencies
vi.mock('$lib/server/analytics.js', () => ({
	getDashboardStats: vi.fn(),
	getUserApiStats: vi.fn(),
	getUserActivity: vi.fn(),
	getUserStorageStats: vi.fn()
}));

describe('Analytics API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const createMockRequest = (searchParams: Record<string, string> = {}) => {
		const url = new URL('http://localhost:5173/api/analytics');
		Object.entries(searchParams).forEach(([key, value]) => {
			url.searchParams.set(key, value);
		});

		return {
			url,
			locals: {
				session: { user: { id: 'test-user-id' } },
				user: { id: 'test-user-id' }
			}
		};
	};

	it('should return dashboard stats by default', async () => {
		const { getDashboardStats } = await import('$lib/server/analytics.js');
		const mockStats = {
			api: { total_requests: 10 },
			storage: { total_size: 1024 },
			summary: { total_api_calls: 10 }
		};

		vi.mocked(getDashboardStats).mockResolvedValue(mockStats);

		const request = createMockRequest();
		const response = await GET(request as any);
		const result = await response.json();

		expect(result.success).toBe(true);
		expect(result.data).toEqual(mockStats);
		expect(getDashboardStats).toHaveBeenCalledWith('test-user-id');
	});

	it('should return API stats when type=api', async () => {
		const { getUserApiStats } = await import('$lib/server/analytics.js');
		const mockApiStats = { total_requests: 5, total_tokens: 1000 };

		vi.mocked(getUserApiStats).mockResolvedValue(mockApiStats);

		const request = createMockRequest({ type: 'api' });
		const response = await GET(request as any);
		const result = await response.json();

		expect(result.success).toBe(true);
		expect(result.data).toEqual(mockApiStats);
		expect(getUserApiStats).toHaveBeenCalledWith('test-user-id', undefined, undefined);
	});

	it('should return storage stats when type=storage', async () => {
		const { getUserStorageStats } = await import('$lib/server/analytics.js');
		const mockStorageStats = { total_size: 2048, total_files: 5 };

		vi.mocked(getUserStorageStats).mockResolvedValue(mockStorageStats);

		const request = createMockRequest({ type: 'storage' });
		const response = await GET(request as any);
		const result = await response.json();

		expect(result.success).toBe(true);
		expect(result.data).toEqual(mockStorageStats);
		expect(getUserStorageStats).toHaveBeenCalledWith('test-user-id');
	});

	it('should return activity data when type=activity', async () => {
		const { getUserActivity } = await import('$lib/server/analytics.js');
		const mockActivity = [
			{ action: 'chat_completion', created_at: '2024-01-01T00:00:00Z' }
		];

		vi.mocked(getUserActivity).mockResolvedValue(mockActivity);

		const request = createMockRequest({ 
			type: 'activity',
			limit: '10',
			offset: '5'
		});
		const response = await GET(request as any);
		const result = await response.json();

		expect(result.success).toBe(true);
		expect(result.data).toEqual(mockActivity);
		expect(getUserActivity).toHaveBeenCalledWith('test-user-id', 10, 5);
	});

	it('should handle date range parameters for API stats', async () => {
		const { getUserApiStats } = await import('$lib/server/analytics.js');
		
		vi.mocked(getUserApiStats).mockResolvedValue({});

		const request = createMockRequest({
			type: 'api',
			start_date: '2024-01-01',
			end_date: '2024-01-31'
		});
		
		await GET(request as any);

		expect(getUserApiStats).toHaveBeenCalledWith(
			'test-user-id',
			new Date('2024-01-01'),
			new Date('2024-01-31')
		);
	});

	it('should require authentication', async () => {
		const request = {
			url: new URL('http://localhost:5173/api/analytics'),
			locals: {
				session: null,
				user: null
			}
		};

		try {
			await GET(request as any);
			expect.fail('Should have thrown an error');
		} catch (error) {
			expect(error).toBeDefined();
		}
	});

	it('should handle errors gracefully', async () => {
		const { getDashboardStats } = await import('$lib/server/analytics.js');
		
		vi.mocked(getDashboardStats).mockRejectedValue(new Error('Database error'));

		const request = createMockRequest();
		
		try {
			await GET(request as any);
			expect.fail('Should have thrown an error');
		} catch (error) {
			expect(error).toBeDefined();
		}
	});
});
