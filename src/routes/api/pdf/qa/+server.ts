import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	answerPdfQuestion,
	answerWithContext,
	processPdfToChunks,
	summarizePdf,
	extractKeyInfo
} from '$lib/server/pdf-processor.js';
import { downloadFile, STORAGE_BUCKETS } from '$lib/server/storage.js';
import { createApiTracker, trackUserActivity } from '$lib/server/analytics.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	const startTime = Date.now();
	const tracker = createApiTracker({ request, locals } as any, startTime);

	try {
		// Require authentication
		if (!locals.session || !locals.user) {
			error(401, 'Authentication required');
		}

		const {
			pdf_path,
			pdf_content,
			question,
			action = 'answer', // 'answer', 'summarize', 'extract'
			model = 'openai/gpt-3.5-turbo',
			max_tokens = 1000,
			extract_fields = []
		} = await request.json();

		// Validate input
		if (!pdf_path && !pdf_content) {
			error(400, 'Either pdf_path or pdf_content is required');
		}

		let content = pdf_content;

		// If pdf_path is provided, download and process the PDF
		if (pdf_path) {
			const { data: blob, error: downloadError } = await downloadFile(
				STORAGE_BUCKETS.DOCUMENTS,
				pdf_path
			);

			if (downloadError || !blob) {
				error(500, 'Failed to download PDF');
			}

			// Convert blob to text (simplified - in production use proper PDF parser)
			content = await blob.text();
		}

		let result: any;
		let tokensUsed = 0;

		switch (action) {
			case 'summarize':
				result = await summarizePdf(content, model, max_tokens);
				tokensUsed = Math.ceil(result.length * 0.75); // Rough estimate
				break;

			case 'extract':
				if (!extract_fields || extract_fields.length === 0) {
					error(400, 'extract_fields is required for extraction');
				}
				result = await extractKeyInfo(content, extract_fields, model);
				tokensUsed = 500; // Rough estimate
				break;

			case 'answer':
			default:
				if (!question) {
					error(400, 'Question is required for Q&A');
				}

				// Process PDF into chunks for better context handling
				const chunks = await processPdfToChunks(pdf_path || 'temp', 2000, 200);
				
				// Answer with context from relevant chunks
				const response = await answerWithContext(chunks, question, model);
				result = response.answer;
				tokensUsed = Math.ceil(result.length * 0.75); // Rough estimate
				break;
		}

		// Track API usage
		await tracker.track({
			userId: locals.user.id,
			model,
			tokensUsed,
			statusCode: 200
		});

		// Track user activity
		await trackUserActivity({
			user_id: locals.user.id,
			action: `pdf_${action}`,
			details: {
				pdf_path,
				model,
				tokens: tokensUsed,
				question: action === 'answer' ? question : undefined
			}
		});

		return json({
			success: true,
			data: {
				result,
				action,
				model,
				tokens_used: tokensUsed
			}
		});
	} catch (err) {
		console.error('PDF Q&A error:', err);

		// Track error
		if (locals.user?.id) {
			await tracker.track({
				userId: locals.user.id,
				statusCode: 500,
				error: err instanceof Error ? err.message : 'Unknown error'
			});
		}

		if (err instanceof Error) {
			error(500, err.message);
		}

		error(500, 'Failed to process PDF Q&A');
	}
};

