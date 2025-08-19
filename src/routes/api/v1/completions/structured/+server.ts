import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { createApiHandler, validateRequestBody } from '$lib/server/api-middleware.js';
import {
	createStructuredCompletion,
	type StructuredCompletionRequest
} from '$lib/server/structured-outputs.js';

// POST /api/v1/completions/structured - Create structured completion
export const POST: RequestHandler = createApiHandler(
	async (event, auth) => {
		const body = await event.request.json();
		validateRequestBody(body, ['messages']);
		
		// Validate messages
		if (!Array.isArray(body.messages) || body.messages.length === 0) {
			error(400, {
				message: 'Messages must be a non-empty array',
				code: 'INVALID_MESSAGES'
			});
		}
		
		// Validate message format
		for (const [index, message] of body.messages.entries()) {
			if (!message.role || !message.content) {
				error(400, {
					message: `Message at index ${index} must have role and content`,
					code: 'INVALID_MESSAGE_FORMAT'
				});
			}
			
			if (!['system', 'user', 'assistant'].includes(message.role)) {
				error(400, {
					message: `Invalid message role at index ${index}: ${message.role}`,
					code: 'INVALID_MESSAGE_ROLE'
				});
			}
		}
		
		// Must provide either schema_id or direct schema
		if (!body.schema_id && !body.schema) {
			error(400, {
				message: 'Either schema_id or schema must be provided',
				code: 'MISSING_SCHEMA'
			});
		}
		
		const request: StructuredCompletionRequest = {
			messages: body.messages,
			model: body.model || 'openai/gpt-3.5-turbo',
			temperature: body.temperature,
			max_tokens: body.max_tokens,
			top_p: body.top_p,
			frequency_penalty: body.frequency_penalty,
			presence_penalty: body.presence_penalty,
			schema_id: body.schema_id,
			schema: body.schema,
			strict: body.strict,
			max_retries: body.max_retries,
			return_raw_response: body.return_raw_response,
			user_id: auth.user_id,
			apiKey: event.request.headers.get('x-openrouter-api-key') || undefined
		};
		
		// Validate retry count
		if (request.max_retries !== undefined && (request.max_retries < 0 || request.max_retries > 10)) {
			error(400, {
				message: 'max_retries must be between 0 and 10',
				code: 'INVALID_MAX_RETRIES'
			});
		}
		
		const result = await createStructuredCompletion(request);
		return result;
	},
	{ 
		required_scope: 'write',
		track_usage: true
	}
);