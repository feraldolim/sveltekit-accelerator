import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { createApiHandler } from '$lib/server/api-middleware.js';
import { getFileUpload, processFile, type ProcessingOptions } from '$lib/server/file-processor.js';

// POST /api/v1/files/:id/extract - Extract text from PDF
export const POST: RequestHandler = createApiHandler(
	async (event, auth) => {
		const fileId = event.params.id!;
		const body = await event.request.json().catch(() => ({}));
		
		const file = await getFileUpload(auth.user_id, fileId);
		if (!file) {
			error(404, {
				message: 'File not found',
				code: 'FILE_NOT_FOUND'
			});
		}
		
		if (file.file_type !== 'pdf') {
			error(400, {
				message: 'Text extraction is only available for PDF files',
				code: 'INVALID_FILE_TYPE'
			});
		}
		
		const options: ProcessingOptions = {
			extract_text: true,
			extract_metadata: body.extract_metadata !== false,
			format: body.format || 'text',
			analyze_content: body.analyze_content === true,
			custom_prompt: body.custom_prompt,
			model: body.model
		};
		
		const result = await processFile(fileId, options);
		
		if (!result.success) {
			error(500, {
				message: result.error || 'Failed to extract text',
				code: 'EXTRACTION_FAILED'
			});
		}
		
		return {
			file_id: fileId,
			extracted_data: result.data,
			processing_status: 'completed'
		};
	},
	{ required_scope: 'write' }
);