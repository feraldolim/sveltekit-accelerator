import { requireAuth } from '$lib/server/auth.js';
import { getProcessingStats } from '$lib/server/file-processor.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const session = await requireAuth(event);
	
	try {
		const stats = await getProcessingStats(session.user.id);
		
		// Transform the data to match expected structure
		const fileStats = {
			total_files: stats.total_files,
			processed_files: stats.by_status.completed || 0,
			failed_files: stats.by_status.failed || 0,
			total_size: stats.total_size,
			processing_time_avg: 0, // Not available from getProcessingStats
			recent_files: [] // Could be fetched separately if needed
		};
		
		return {
			fileStats
		};
	} catch (error) {
		console.error('Error loading file processing stats:', error);
		return {
			fileStats: {
				total_files: 0,
				processed_files: 0,
				failed_files: 0,
				total_size: 0,
				processing_time_avg: 0,
				recent_files: []
			}
		};
	}
};