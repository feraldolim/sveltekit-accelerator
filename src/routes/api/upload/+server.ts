import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uploadFile, isValidFileType, isValidFileSize, STORAGE_BUCKETS, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from '$lib/server/storage.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Require authentication
		if (!locals.session || !locals.user) {
			error(401, 'Authentication required');
		}

		const formData = await request.formData();
		const file = formData.get('file') as File;
		const bucket = formData.get('bucket') as string || STORAGE_BUCKETS.UPLOADS;
		const path = formData.get('path') as string || `user-${locals.user.id}`;

		// Validate file
		if (!file || file.size === 0) {
			error(400, 'No file provided');
		}

		// Validate file type (customize based on your needs)
		if (!isValidFileType(file, ALLOWED_IMAGE_TYPES)) {
			error(400, 'Invalid file type');
		}

		// Validate file size
		if (!isValidFileSize(file, MAX_FILE_SIZE)) {
			error(400, 'File too large');
		}

		// Upload file
		const { data, error: uploadError } = await uploadFile(file, {
			bucket,
			path,
			contentType: file.type
		});

		if (uploadError) {
			console.error('Upload error:', uploadError);
			error(500, 'Failed to upload file');
		}

		return json({
			success: true,
			file: data,
			message: 'File uploaded successfully'
		});

	} catch (err) {
		console.error('Upload API error:', err);
		
		if (err instanceof Error) {
			if (err.message.includes('Authentication required')) {
				error(401, 'Authentication required');
			}
			if (err.message.includes('Invalid file type')) {
				error(400, 'Invalid file type');
			}
			if (err.message.includes('File too large')) {
				error(400, 'File too large');
			}
		}
		
		error(500, 'Internal server error');
	}
};