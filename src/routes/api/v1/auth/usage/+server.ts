import type { RequestHandler } from './$types';
import { createApiHandler, validateQueryParams } from '$lib/server/api-middleware.js';
import { getApiUsageStats } from '$lib/server/api-keys.js';

// GET /api/v1/auth/usage - Get API usage statistics
export const GET: RequestHandler = createApiHandler(
	async (event, auth) => {
		const url = new URL(event.request.url);
		validateQueryParams(url, ['days']);
		
		const daysParam = url.searchParams.get('days');
		const days = daysParam ? parseInt(daysParam, 10) : 30;
		
		if (isNaN(days) || days < 1 || days > 365) {
			throw new Error('Days parameter must be between 1 and 365');
		}
		
		const stats = await getApiUsageStats(auth.user_id, days);
		
		return {
			period: {
				days,
				start_date: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
				end_date: new Date().toISOString().split('T')[0]
			},
			...stats
		};
	},
	{ required_scope: 'read' }
);