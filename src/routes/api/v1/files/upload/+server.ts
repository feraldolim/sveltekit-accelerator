import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { createApiHandler } from '$lib/server/api-middleware.js';
import {
	createFileUpload,
	validateFile,
	processFile,
	type ProcessingOptions
} from '$lib/server/file-processor.js';

// POST /api/v1/files/upload - Upload file
export const POST: RequestHandler = createApiHandler(
	async (event, auth) => {
		const formData = await event.request.formData();
		const file = formData.get('file') as File;
		const processNow = formData.get('process') === 'true';
		const options = formData.get('options') ? JSON.parse(formData.get('options') as string) : {};
		
		if (!file) {
			error(400, {
				message: 'File is required',
				code: 'MISSING_FILE'
			});
		}
		
		// Validate file
		const validation = validateFile(file);
		if (!validation.valid) {
			error(400, {
				message: validation.error!,
				code: 'INVALID_FILE'
			});
		}
		
		// In a real implementation, you would save the file to storage
		// For now, we'll create a mock file path
		const mockFilePath = `uploads/${auth.user_id}/${Date.now()}_${file.name}`;
		
		// Create file upload record
		const fileUpload = await createFileUpload(
			auth.user_id,
			file,
			mockFilePath,
			validation.file_type as 'pdf' | 'image' | 'audio'
		);
		
		// Process file if requested
		if (processNow) {
			const processingOptions: ProcessingOptions = {
				extract_text: options.extract_text !== false,
				extract_metadata: options.extract_metadata !== false,
				analyze_content: options.analyze_content === true,
				custom_prompt: options.custom_prompt,
				model: options.model,
				language: options.language,
				format: options.format
			};
			
			// Process asynchronously (in a real implementation, you'd use a queue)
			processFile(fileUpload.id, processingOptions).catch(error => {
				console.error('File processing failed:', error);
			});
		}
		
		return {
			id: fileUpload.id,
			original_name: fileUpload.original_name,
			file_type: fileUpload.file_type,
			file_size: fileUpload.file_size,
			processing_status: fileUpload.processing_status,
			created_at: fileUpload.created_at
		};
	},
	{ required_scope: 'write' }
);