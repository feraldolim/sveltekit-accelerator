import { supabaseAdmin } from './supabase.js';
import type { RequestEvent } from '@sveltejs/kit';

interface ApiUsageData {
	user_id: string;
	endpoint: string;
	method: string;
	model?: string;
	tokens_used?: number;
	response_time?: number;
	status_code?: number;
	error_message?: string;
}

interface UserActivityData {
	user_id: string;
	action: string;
	details?: Record<string, unknown>;
	ip_address?: string;
	user_agent?: string;
}

/**
 * Track API usage for analytics
 */
export async function trackApiUsage(data: ApiUsageData): Promise<void> {
	try {
		const { error } = await supabaseAdmin.from('api_usage').insert({
			...data,
			created_at: new Date().toISOString()
		});

		if (error) {
			console.error('Failed to track API usage:', error);
		}
	} catch (err) {
		console.error('Error tracking API usage:', err);
	}
}

/**
 * Track user activity
 */
export async function trackUserActivity(data: UserActivityData): Promise<void> {
	try {
		const { error } = await supabaseAdmin.from('user_activity').insert({
			...data,
			created_at: new Date().toISOString()
		});

		if (error) {
			console.error('Failed to track user activity:', error);
		}
	} catch (err) {
		console.error('Error tracking user activity:', err);
	}
}

/**
 * Get user's API usage statistics
 */
export async function getUserApiStats(
	userId: string,
	startDate?: Date,
	endDate?: Date
) {
	let query = supabaseAdmin
		.from('api_usage')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false });

	if (startDate) {
		query = query.gte('created_at', startDate.toISOString());
	}

	if (endDate) {
		query = query.lte('created_at', endDate.toISOString());
	}

	const { data, error } = await query;

	if (error) {
		console.error('Failed to get API stats:', error);
		return null;
	}

	// Calculate statistics
	const stats = {
		total_requests: data?.length || 0,
		total_tokens: data?.reduce((sum, item) => sum + (item.tokens_used || 0), 0) || 0,
		average_response_time:
			data?.reduce((sum, item) => sum + (item.response_time || 0), 0) / (data?.length || 1) ||
			0,
		by_model: {} as Record<string, number>,
		by_endpoint: {} as Record<string, number>,
		errors: data?.filter((item) => item.error_message).length || 0,
		recent_usage: data?.slice(0, 10) || []
	};

	// Group by model
	data?.forEach((item) => {
		if (item.model) {
			stats.by_model[item.model] = (stats.by_model[item.model] || 0) + 1;
		}
		stats.by_endpoint[item.endpoint] = (stats.by_endpoint[item.endpoint] || 0) + 1;
	});

	return stats;
}

/**
 * Get user's activity history
 */
export async function getUserActivity(
	userId: string,
	limit: number = 50,
	offset: number = 0
) {
	const { data, error } = await supabaseAdmin
		.from('user_activity')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.range(offset, offset + limit - 1);

	if (error) {
		console.error('Failed to get user activity:', error);
		return null;
	}

	return data;
}

/**
 * Get storage usage for a user
 */
export async function getUserStorageStats(userId: string) {
	const { data, error } = await supabaseAdmin
		.from('storage_usage')
		.select('*')
		.eq('user_id', userId)
		.is('deleted_at', null);

	if (error) {
		console.error('Failed to get storage stats:', error);
		return null;
	}

	const stats = {
		total_files: data?.length || 0,
		total_size: data?.reduce((sum, item) => sum + (item.file_size || 0), 0) || 0,
		by_type: {} as Record<string, { count: number; size: number }>,
		recent_uploads: data?.slice(0, 10) || []
	};

	// Group by MIME type
	data?.forEach((item) => {
		const type = item.mime_type || 'unknown';
		if (!stats.by_type[type]) {
			stats.by_type[type] = { count: 0, size: 0 };
		}
		stats.by_type[type].count += 1;
		stats.by_type[type].size += item.file_size || 0;
	});

	return stats;
}

/**
 * Track storage usage when a file is uploaded
 */
export async function trackStorageUsage(data: {
	user_id: string;
	bucket: string;
	file_path: string;
	file_size: number;
	mime_type?: string;
}): Promise<void> {
	try {
		const { error } = await supabaseAdmin.from('storage_usage').insert({
			...data,
			created_at: new Date().toISOString()
		});

		if (error) {
			console.error('Failed to track storage usage:', error);
		}
	} catch (err) {
		console.error('Error tracking storage usage:', err);
	}
}

/**
 * Middleware to track API requests
 */
export function createApiTracker(event: RequestEvent, startTime: number = Date.now()) {
	return {
		async track(options: {
			userId?: string;
			model?: string;
			tokensUsed?: number;
			statusCode?: number;
			error?: string;
		}) {
			const responseTime = Date.now() - startTime;
			const { url, method } = event.request;
			const endpoint = new URL(url).pathname;

			if (options.userId) {
				await trackApiUsage({
					user_id: options.userId,
					endpoint,
					method,
					model: options.model,
					tokens_used: options.tokensUsed,
					response_time: responseTime,
					status_code: options.statusCode,
					error_message: options.error
				});
			}
		}
	};
}

/**
 * Get aggregated statistics for dashboard
 */
export async function getDashboardStats(userId: string) {
	const now = new Date();
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	const [apiStats, storageStats, recentActivity] = await Promise.all([
		getUserApiStats(userId, thirtyDaysAgo),
		getUserStorageStats(userId),
		getUserActivity(userId, 10)
	]);

	// Get weekly API stats for chart
	const weeklyStats = await getUserApiStats(userId, sevenDaysAgo);

	return {
		api: apiStats,
		storage: storageStats,
		activity: recentActivity,
		weekly: weeklyStats,
		summary: {
			total_api_calls: apiStats?.total_requests || 0,
			total_tokens: apiStats?.total_tokens || 0,
			total_storage: storageStats?.total_size || 0,
			total_files: storageStats?.total_files || 0,
			error_rate: apiStats
				? ((apiStats.errors / apiStats.total_requests) * 100).toFixed(2)
				: '0'
		}
	};
}

