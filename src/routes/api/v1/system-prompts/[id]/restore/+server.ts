import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { createApiHandler } from '$lib/server/api-middleware.js';
import { restorePromptVersion } from '$lib/server/system-prompts.js';

// POST /api/v1/system-prompts/:id/restore - Restore a system prompt to a previous version
export const POST: RequestHandler = async (event) => {
	const authHeader = event.request.headers.get('Authorization');
	const promptId = event.params.id!;
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		return handleRestoreVersion(event, session.user.id, promptId);
	} else {
		// Use API key auth for external requests
		return createApiHandler(async (event, { user_id }) => {
			return handleRestoreVersion(event, user_id, promptId);
		}, {
			required_scope: 'system-prompts:write',
			track_usage: true
		})(event);
	}
};

async function handleRestoreVersion(event: any, userId: string, promptId: string) {
	try {
		const body = await event.request.json();
		const { version, changeSummary } = body;
		
		if (!version) {
			return json({ error: 'Version number is required' }, { status: 400 });
		}
		
		const restoredPrompt = await restorePromptVersion(
			userId, 
			promptId, 
			version,
			changeSummary || `Restored to version ${version}`
		);
		
		return json(restoredPrompt);
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to restore version' }, 
			{ status: 500 }
		);
	}
}