import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { createApiHandler } from '$lib/server/api-middleware.js';
import { deleteStructuredOutput, updateStructuredOutput, getStructuredOutput } from '$lib/server/structured-outputs.js';

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
			required_scope: 'structured-outputs:read',
			track_usage: true
		})(event);
	}
};

async function handleGetRequest(event: any, userId: string, outputId: string) {
	try {
		const output = await getStructuredOutput(userId, outputId);
		
		if (!output) {
			return json({ error: 'Schema not found' }, { status: 404 });
		}

		return json({
			...output,
			schema: output.json_schema
		});

	} catch (error) {
		console.error('Error fetching structured output:', error);
		return json({ error: 'Failed to fetch structured output' }, { status: 500 });
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
			required_scope: 'structured-outputs:write',
			track_usage: true
		})(event);
	}
};

async function handlePutRequest(event: any, userId: string, outputId: string) {
	try {
		const { name, description, json_schema, is_public } = await event.request.json();

		const updatedOutput = await updateStructuredOutput(userId, outputId, {
			name,
			description,
			json_schema,
			is_public
		}, 'Updated via API');

		return json({
			...updatedOutput,
			schema: updatedOutput.json_schema
		});

	} catch (error) {
		console.error('Error updating structured output:', error);
		return json({ 
			error: error instanceof Error ? error.message : 'Failed to update structured output' 
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
			required_scope: 'structured-outputs:write',
			track_usage: true
		})(event);
	}
};

async function handleDeleteRequest(event: any, userId: string, outputId: string) {
	try {
		await deleteStructuredOutput(userId, outputId);
		return json({ success: true, message: 'Schema deleted successfully' });

	} catch (error) {
		console.error('Error deleting structured output:', error);
		return json({ 
			error: error instanceof Error ? error.message : 'Failed to delete structured output' 
		}, { status: 500 });
	}
};