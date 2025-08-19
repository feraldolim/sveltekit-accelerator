import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { createApiHandler } from '$lib/server/api-middleware.js';
import { getPromptVersions } from '$lib/server/system-prompts.js';

// GET /api/v1/system-prompts/:id/versions - Get version history for a system prompt
export const GET: RequestHandler = async (event) => {
	const authHeader = event.request.headers.get('Authorization');
	const promptId = event.params.id!;
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		return handleGetVersions(session.user.id, promptId);
	} else {
		// Use API key auth for external requests
		return createApiHandler(async (event, { user_id }) => {
			return handleGetVersions(user_id, promptId);
		}, {
			required_scope: 'system-prompts:read',
			track_usage: true
		})(event);
	}
};

async function handleGetVersions(userId: string, promptId: string) {
	try {
		const versions = await getPromptVersions(userId, promptId);
		return json(versions);
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to get version history' }, 
			{ status: 500 }
		);
	}
}