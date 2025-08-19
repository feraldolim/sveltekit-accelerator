import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { createApiHandler } from '$lib/server/api-middleware.js';
import { createSystemPrompt, listSystemPrompts } from '$lib/server/system-prompts.js';

export const GET: RequestHandler = async (event) => {
	const authHeader = event.request.headers.get('Authorization');
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		return handleGetRequest(event, session.user.id);
	} else {
		// Use API key auth for external requests
		return createApiHandler(async (event, { user_id }) => {
			return handleGetRequest(event, user_id);
		}, {
			required_scope: 'system-prompts:read',
			track_usage: true
		})(event);
	}
};

async function handleGetRequest(event: any, userId: string) {
	try {
		const url = new URL(event.request.url);
		const search = url.searchParams.get('search') || '';
		const category = url.searchParams.get('category') || '';

		const prompts = await listSystemPrompts(userId, { 
			search: search || undefined,
			category: category || undefined,
			include_public: false 
		});

		// Process prompts to match expected format and validate them
		const processedPrompts = prompts?.map(prompt => {
			return {
				...prompt,
				usage_count: prompt.usage_count || 0
			};
		}) || [];

		return json({
			prompts: processedPrompts,
			filters: { search, category }
		});

	} catch (error) {
		console.error('Error fetching system prompts:', error);
		return json({ error: 'Failed to fetch system prompts' }, { status: 500 });
	}
}

export const POST: RequestHandler = async (event) => {
	const authHeader = event.request.headers.get('Authorization');
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		return handlePostRequest(event, session.user.id);
	} else {
		// Use API key auth for external requests
		return createApiHandler(async (event, { user_id }) => {
			return handlePostRequest(event, user_id);
		}, {
			required_scope: 'system-prompts:write',
			track_usage: true
		})(event);
	}
};

async function handlePostRequest(event: any, userId: string) {
	try {
		const { name, description, content, variables, category, is_public = false } = await event.request.json();

		const newPrompt = await createSystemPrompt(userId, {
			name,
			description,
			content,
			variables,
			category,
			is_public
		});

		return json(newPrompt);

	} catch (error) {
		console.error('Error creating system prompt:', error);
		return json({ 
			error: error instanceof Error ? error.message : 'Failed to create system prompt' 
		}, { status: 500 });
	}
}