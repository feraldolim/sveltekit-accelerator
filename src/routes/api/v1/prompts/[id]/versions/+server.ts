import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { getPromptVersions } from '$lib/server/system-prompts.js';

// GET /api/v1/prompts/:id/versions - Get version history for a prompt
export const GET: RequestHandler = async (event) => {
	const session = await requireAuth(event);
	const promptId = event.params.id!;
	
	try {
		const versions = await getPromptVersions(session.user.id, promptId);
		return json(versions);
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to get version history' }, 
			{ status: 400 }
		);
	}
};