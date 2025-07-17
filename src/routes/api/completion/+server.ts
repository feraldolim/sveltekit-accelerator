import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText } from '$lib/server/llm.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Require authentication
		if (!locals.session || !locals.user) {
			error(401, 'Authentication required');
		}

		const { prompt, system_prompt, model } = await request.json();

		// Validate input
		if (!prompt || typeof prompt !== 'string') {
			error(400, 'Prompt is required and must be a string');
		}

		if (prompt.length > 4000) {
			error(400, 'Prompt is too long (max 4000 characters)');
		}

		// Generate text
		const response = await generateText(prompt, system_prompt, model || 'openai/gpt-3.5-turbo');

		return json({
			text: response,
			prompt,
			model: model || 'openai/gpt-3.5-turbo',
			user_id: locals.user.id
		});
	} catch (err) {
		console.error('Completion API error:', err);

		if (err instanceof Error) {
			// Handle specific errors
			if (err.message.includes('OpenRouter API error')) {
				error(502, 'AI service temporarily unavailable');
			}
			if (err.message.includes('redirect')) {
				error(401, 'Authentication required');
			}
		}

		error(500, 'Internal server error');
	}
};
