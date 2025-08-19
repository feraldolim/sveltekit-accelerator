import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { createApiHandler } from '$lib/server/api-middleware.js';
import { deleteSystemPrompt, updateSystemPrompt, getSystemPrompt } from '$lib/server/system-prompts.js';

export const GET: RequestHandler = async (event) => {
	const authHeader = event.request.headers.get('Authorization');
	const { id } = event.params;
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		return handleGetRequest(event, session.user.id, id);
	} else {
		// Use API key auth for external requests
		return createApiHandler(async (event, { user_id }) => {
			return handleGetRequest(event, user_id, id);
		}, {
			required_scope: 'system-prompts:read',
			track_usage: true
		})(event);
	}
};

async function handleGetRequest(event: any, userId: string, promptId: string) {
	try {
		const prompt = await getSystemPrompt(userId, promptId);
		
		if (!prompt) {
			return json({ error: 'System prompt not found' }, { status: 404 });
		}

		return json(prompt);

	} catch (error) {
		console.error('Error fetching system prompt:', error);
		return json({ error: 'Failed to fetch system prompt' }, { status: 500 });
	}
}

export const PUT: RequestHandler = async (event) => {
	const authHeader = event.request.headers.get('Authorization');
	const { id } = event.params;
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		return handlePutRequest(event, session.user.id, id);
	} else {
		// Use API key auth for external requests
		return createApiHandler(async (event, { user_id }) => {
			return handlePutRequest(event, user_id, id);
		}, {
			required_scope: 'system-prompts:write',
			track_usage: true
		})(event);
	}
};

async function handlePutRequest(event: any, userId: string, promptId: string) {
	try {
		const { name, description, content, variables, category, is_public } = await event.request.json();

		const updatedPrompt = await updateSystemPrompt(userId, promptId, {
			name,
			description,
			content,
			variables,
			category,
			is_public
		}, 'Updated via API');

		return json(updatedPrompt);

	} catch (error) {
		console.error('Error updating system prompt:', error);
		return json({ 
			error: error instanceof Error ? error.message : 'Failed to update system prompt' 
		}, { status: 500 });
	}
}

export const DELETE: RequestHandler = async (event) => {
	const authHeader = event.request.headers.get('Authorization');
	const { id } = event.params;
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		return handleDeleteRequest(event, session.user.id, id);
	} else {
		// Use API key auth for external requests
		return createApiHandler(async (event, { user_id }) => {
			return handleDeleteRequest(event, user_id, id);
		}, {
			required_scope: 'system-prompts:write',
			track_usage: true
		})(event);
	}
};

async function handleDeleteRequest(event: any, userId: string, promptId: string) {
	try {
		await deleteSystemPrompt(userId, promptId);
		return json({ success: true, message: 'System prompt deleted successfully' });

	} catch (error) {
		console.error('Error deleting system prompt:', error);
		return json({ 
			error: error instanceof Error ? error.message : 'Failed to delete system prompt' 
		}, { status: 500 });
	}
};