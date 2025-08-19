import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { restorePromptVersion } from '$lib/server/system-prompts.js';

// POST /api/v1/prompts/:id/restore - Restore a prompt to a previous version
export const POST: RequestHandler = async (event) => {
	const session = await requireAuth(event);
	const promptId = event.params.id!;
	
	try {
		const body = await event.request.json();
		const { version, changeSummary } = body;
		
		if (!version) {
			return json({ error: 'Version number is required' }, { status: 400 });
		}
		
		const restoredPrompt = await restorePromptVersion(
			session.user.id, 
			promptId, 
			version,
			changeSummary || `Restored to version ${version}`
		);
		
		return json(restoredPrompt);
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to restore version' }, 
			{ status: 400 }
		);
	}
};