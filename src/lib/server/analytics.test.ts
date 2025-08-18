import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackApiUsage, trackUserActivity, createApiTracker } from './analytics.js';

// Mock Supabase
vi.mock('./supabase.js', () => ({
	supabaseAdmin: {
		from: vi.fn(() => ({
			insert: vi.fn(() => ({ error: null })),
			select: vi.fn(() => ({
				eq: vi.fn(() => ({
					order: vi.fn(() => ({
						gte: vi.fn(() => ({
							lte: vi.fn(() => ({ data: [], error: null }))
						})),
						data: [],
						error: null
					})),
					data: [],
					error: null
				})),
				data: [],
				error: null
			}))
		}))
	}
}));

describe('Analytics Functions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('trackApiUsage', () => {
		it('should track API usage successfully', async () => {
			const apiUsageData = {
				user_id: 'test-user-id',
				endpoint: '/api/chat',
				method: 'POST',
				model: 'openai/gpt-3.5-turbo',
				tokens_used: 150,
				response_time: 1200,
				status_code: 200
			};

			await expect(trackApiUsage(apiUsageData)).resolves.toBeUndefined();
		});

		it('should handle errors gracefully', async () => {
			const { supabaseAdmin } = await import('./supabase.js');
			vi.mocked(supabaseAdmin.from).mockReturnValue({
				insert: vi.fn(() => ({ error: new Error('Database error') }))
			} as any);

			const apiUsageData = {
				user_id: 'test-user-id',
				endpoint: '/api/chat',
				method: 'POST'
			};

			// Should not throw
			await expect(trackApiUsage(apiUsageData)).resolves.toBeUndefined();
		});
	});

	describe('trackUserActivity', () => {
		it('should track user activity successfully', async () => {
			const activityData = {
				user_id: 'test-user-id',
				action: 'chat_completion',
				details: { chat_id: 'test-chat-id' },
				ip_address: '127.0.0.1',
				user_agent: 'test-user-agent'
			};

			await expect(trackUserActivity(activityData)).resolves.toBeUndefined();
		});
	});

	describe('createApiTracker', () => {
		it('should create tracker and track usage', async () => {
			const mockEvent = {
				request: {
					url: 'http://localhost:5173/api/chat',
					method: 'POST'
				},
				locals: {
					user: { id: 'test-user-id' }
				}
			};

			const tracker = createApiTracker(mockEvent as any, Date.now());

			await expect(tracker.track({
				userId: 'test-user-id',
				model: 'openai/gpt-3.5-turbo',
				tokensUsed: 100,
				statusCode: 200
			})).resolves.toBeUndefined();
		});
	});
});

