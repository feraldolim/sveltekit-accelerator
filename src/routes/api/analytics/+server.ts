import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDashboardStats, getUserApiStats, getUserActivity, getUserStorageStats } from '$lib/server/analytics.js';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		// Require authentication
		if (!locals.session || !locals.user) {
			error(401, 'Authentication required');
		}

		const type = url.searchParams.get('type') || 'dashboard';
		const startDate = url.searchParams.get('start_date');
		const endDate = url.searchParams.get('end_date');
		const limit = parseInt(url.searchParams.get('limit') || '50');
		const offset = parseInt(url.searchParams.get('offset') || '0');

		let data;

		switch (type) {
			case 'api':
				data = await getUserApiStats(
					locals.user.id,
					startDate ? new Date(startDate) : undefined,
					endDate ? new Date(endDate) : undefined
				);
				break;

			case 'storage':
				data = await getUserStorageStats(locals.user.id);
				break;

			case 'activity':
				data = await getUserActivity(locals.user.id, limit, offset);
				break;

			case 'dashboard':
			default:
				data = await getDashboardStats(locals.user.id);
				break;
		}

		return json({
			success: true,
			data
		});
	} catch (err) {
		console.error('Analytics API error:', err);

		if (err instanceof Error) {
			error(500, err.message);
		}

		error(500, 'Failed to fetch analytics');
	}
};

