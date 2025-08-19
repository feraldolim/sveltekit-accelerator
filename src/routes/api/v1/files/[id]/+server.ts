import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { createApiHandler } from '$lib/server/api-middleware.js';
import { getFileUpload, deleteFileUpload } from '$lib/server/file-processor.js';

// GET /api/v1/files/:id - Get specific file
export const GET: RequestHandler = createApiHandler(
	async (event, auth) => {
		const fileId = event.params.id!;
		
		const file = await getFileUpload(auth.user_id, fileId);
		if (!file) {
			error(404, {
				message: 'File not found',
				code: 'FILE_NOT_FOUND'
			});
		}
		
		return file;
	},
	{ required_scope: 'read' }
);

// DELETE /api/v1/files/:id - Delete file
export const DELETE: RequestHandler = createApiHandler(
	async (event, auth) => {
		const fileId = event.params.id!;
		
		await deleteFileUpload(auth.user_id, fileId);
		
		return {
			deleted: true
		};
	},
	{ required_scope: 'delete' }
);