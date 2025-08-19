import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { createApiHandler } from '$lib/server/api-middleware.js';
import { getOutputVersions } from '$lib/server/structured-outputs.js';

// GET /api/v1/structured-outputs/:id/versions - Get version history for a structured output
export const GET: RequestHandler = async (event) => {
	const authHeader = event.request.headers.get('Authorization');
	const outputId = event.params.id!;
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		return handleGetVersions(session.user.id, outputId);
	} else {
		// Use API key auth for external requests
		return createApiHandler(async (event, { user_id }) => {
			return handleGetVersions(user_id, outputId);
		}, {
			required_scope: 'structured-outputs:read',
			track_usage: true
		})(event);
	}
};

async function handleGetVersions(userId: string, outputId: string) {
	try {
		const versions = await getOutputVersions(userId, outputId);
		return json(versions);
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to get version history' }, 
			{ status: 500 }
		);
	}
}