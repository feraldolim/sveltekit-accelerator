import { requireAuth } from '$lib/server/auth.js';
import { listApiKeys, getApiUsageStats } from '$lib/server/api-keys.js';
import { listSystemPrompts } from '$lib/server/system-prompts.js';
import { listStructuredOutputs } from '$lib/server/structured-outputs.js';
import { getProcessingStats } from '$lib/server/file-processor.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const session = await requireAuth(event);
	const userId = session.user.id;

	try {
		// Get overview statistics in parallel
		const [
			apiKeys,
			usageStats,
			prompts,
			schemas,
			fileStats
		] = await Promise.all([
			listApiKeys(userId),
			getApiUsageStats(userId, 7), // Last 7 days
			listSystemPrompts(userId, { limit: 5 }),
			listStructuredOutputs(userId, { limit: 5 }),
			getProcessingStats(userId)
		]);

		return {
			stats: {
				api_keys: {
					total: apiKeys.length,
					active: apiKeys.filter(key => key.is_active).length
				},
				usage: {
					requests_7d: usageStats.total_requests,
					tokens_7d: usageStats.total_tokens
				},
				prompts: {
					total: prompts.length,
					recent: prompts.slice(0, 3)
				},
				schemas: {
					total: schemas.length,
					recent: schemas.slice(0, 3)
				},
				files: fileStats
			}
		};
	} catch (error) {
		console.error('Error loading developer console stats:', error);
		return {
			stats: {
				api_keys: { total: 0, active: 0 },
				usage: { requests_7d: 0, tokens_7d: 0 },
				prompts: { total: 0, recent: [] },
				schemas: { total: 0, recent: [] },
				files: { 
					total_files: 0, 
					by_type: {}, 
					by_status: {}, 
					total_size: 0, 
					processing_queue_size: 0 
				}
			}
		};
	}
};