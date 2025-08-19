import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { createApiHandler } from '$lib/server/api-middleware.js';
import { createStructuredOutput, listStructuredOutputs } from '$lib/server/structured-outputs.js';

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
			required_scope: 'structured-outputs:read',
			track_usage: true
		})(event);
	}
};

async function handleGetRequest(event: any, userId: string) {
	try {
		const url = new URL(event.request.url);
		const search = url.searchParams.get('search') || '';

		const schemas = await listStructuredOutputs(userId, { 
			search: search || undefined,
			include_public: false 
		});

		// Process schemas to match expected format and validate them
		const processedSchemas = schemas?.map(schema => {
			let isValid = true;
			try {
				// Basic validation - check if it's a valid JSON schema structure
				const jsonSchema = schema.json_schema;
				console.log(`Validating schema ${schema.name}:`, JSON.stringify(jsonSchema, null, 2));
				
				if (!jsonSchema || typeof jsonSchema !== 'object') {
					console.log(`Schema ${schema.name} invalid: not an object`);
					isValid = false;
				} else if (!jsonSchema.type || !jsonSchema.properties) {
					console.log(`Schema ${schema.name} invalid: missing type (${jsonSchema.type}) or properties (${!!jsonSchema.properties})`);
					isValid = false;
				} else {
					console.log(`Schema ${schema.name} is valid`);
				}
			} catch (error) {
				console.log(`Schema ${schema.name} validation error:`, error);
				isValid = false;
			}
			
			return {
				...schema,
				schema: schema.json_schema,
				is_valid: isValid,
				usage_count: schema.usage_count || 0
			};
		}) || [];

		return json({
			schemas: processedSchemas,
			filters: { search }
		});

	} catch (error) {
		console.error('Error fetching structured outputs:', error);
		return json({ error: 'Failed to fetch structured outputs' }, { status: 500 });
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
			required_scope: 'structured-outputs:write',
			track_usage: true
		})(event);
	}
};

async function handlePostRequest(event: any, userId: string) {
	try {
		const { name, description, json_schema, is_public = false } = await event.request.json();

		const newSchema = await createStructuredOutput(userId, {
			name,
			description,
			json_schema,
			is_public
		});

		return json({
			...newSchema,
			schema: newSchema.json_schema
		});

	} catch (error) {
		console.error('Error creating structured output:', error);
		return json({ 
			error: error instanceof Error ? error.message : 'Failed to create structured output' 
		}, { status: 500 });
	}
}