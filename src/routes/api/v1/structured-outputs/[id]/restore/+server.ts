import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { createApiHandler } from '$lib/server/api-middleware.js';
import { restoreOutputVersion } from '$lib/server/structured-outputs.js';

// POST /api/v1/structured-outputs/:id/restore - Restore a structured output to a previous version
export const POST: RequestHandler = async (event) => {
	const authHeader = event.request.headers.get('Authorization');
	const outputId = event.params.id!;
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		return handleRestoreVersion(event, session.user.id, outputId);
	} else {
		// Use API key auth for external requests
		return createApiHandler(async (event, { user_id }) => {
			return handleRestoreVersion(event, user_id, outputId);
		}, {
			required_scope: 'structured-outputs:write',
			track_usage: true
		})(event);
	}
};

async function handleRestoreVersion(event: any, userId: string, outputId: string) {
	try {
		const body = await event.request.json();
		const { version, changeSummary } = body;
		
		if (!version) {
			return json({ error: 'Version number is required' }, { status: 400 });
		}
		
		const restoredOutput = await restoreOutputVersion(
			userId, 
			outputId, 
			version,
			changeSummary || `Restored to version ${version}`
		);
		
		return json(restoredOutput);
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to restore version' }, 
			{ status: 500 }
		);
	}
}