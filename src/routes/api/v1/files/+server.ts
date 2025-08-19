import type { RequestHandler } from './$types';
import { 
	createApiHandler, 
	validateQueryParams,
	parsePagination,
	createApiResponse
} from '$lib/server/api-middleware.js';
import { listFileUploads, getProcessingStats } from '$lib/server/file-processor.js';

// GET /api/v1/files - List file uploads
export const GET: RequestHandler = createApiHandler(
	async (event, auth) => {
		const url = new URL(event.request.url);
		validateQueryParams(url, ['limit', 'offset', 'page', 'file_type', 'processing_status', 'include_public', 'search', 'stats']);
		
		// If stats is requested, return processing statistics
		if (url.searchParams.get('stats') === 'true') {
			const stats = await getProcessingStats(auth.user_id);
			return stats;
		}
		
		const { limit, offset } = parsePagination(url);
		const fileType = url.searchParams.get('file_type') as 'pdf' | 'image' | 'audio' | undefined;
		const processingStatus = url.searchParams.get('processing_status') || undefined;
		const includePublic = url.searchParams.get('include_public') !== 'false';
		const search = url.searchParams.get('search') || undefined;
		
		const files = await listFileUploads(auth.user_id, {
			file_type: fileType,
			processing_status,
			include_public: includePublic,
			search,
			limit,
			offset
		});
		
		return createApiResponse(files, {
			total: files.length,
			limit,
			offset
		});
	},
	{ required_scope: 'read' }
);