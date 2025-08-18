import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uploadPdfForQA } from '$lib/server/pdf-processor.js';
import { trackUserActivity } from '$lib/server/analytics.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Require authentication
		if (!locals.session || !locals.user) {
			error(401, 'Authentication required');
		}

		const formData = await request.formData();
		const file = formData.get('file') as File;
		const processImmediately = formData.get('process') === 'true';

		if (!file) {
			error(400, 'No file provided');
		}

		if (file.type !== 'application/pdf') {
			error(400, 'File must be a PDF');
		}

		// Max 10MB
		const maxSize = 10 * 1024 * 1024;
		if (file.size > maxSize) {
			error(400, 'File size must be less than 10MB');
		}

		// Upload the PDF
		const result = await uploadPdfForQA(file, locals.user.id, processImmediately);

		// Track user activity
		await trackUserActivity({
			user_id: locals.user.id,
			action: 'pdf_upload',
			details: {
				file_name: file.name,
				file_size: file.size,
				processed: processImmediately,
				pdf_id: result.id
			}
		});

		return json({
			success: true,
			data: result
		});
	} catch (err) {
		console.error('PDF upload error:', err);

		if (err instanceof Error) {
			error(500, err.message);
		}

		error(500, 'Failed to upload PDF');
	}
};

