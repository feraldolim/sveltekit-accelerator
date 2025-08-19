import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { 
	createApiHandler, 
	validateRequestBody, 
	validateQueryParams,
	parsePagination,
	createApiResponse
} from '$lib/server/api-middleware.js';
import {
	createStructuredOutput,
	listStructuredOutputs,
	getTrendingStructuredOutputs,
	type CreateStructuredOutputRequest
} from '$lib/server/structured-outputs.js';

// GET /api/v1/schemas - List structured output schemas
export const GET: RequestHandler = createApiHandler(
	async (event, auth) => {
		const url = new URL(event.request.url);
		validateQueryParams(url, ['limit', 'offset', 'page', 'include_public', 'search', 'trending']);
		
		const { limit, offset } = parsePagination(url);
		const includePublic = url.searchParams.get('include_public') !== 'false';
		const search = url.searchParams.get('search') || undefined;
		const trending = url.searchParams.get('trending') === 'true';
		
		let schemas;
		
		if (trending) {
			schemas = await getTrendingStructuredOutputs(limit);
		} else {
			schemas = await listStructuredOutputs(auth.user_id, {
				include_public: includePublic,
				search,
				limit,
				offset
			});
		}
		
		return createApiResponse(schemas, {
			total: schemas.length,
			limit,
			offset
		});
	},
	{ required_scope: 'read' }
);

// POST /api/v1/schemas - Create structured output schema
export const POST: RequestHandler = createApiHandler(
	async (event, auth) => {
		const body = await event.request.json();
		validateRequestBody(body, ['name', 'json_schema']);
		
		// Basic JSON schema validation
		if (!body.json_schema || typeof body.json_schema !== 'object') {
			error(400, {
				message: 'json_schema must be a valid object',
				code: 'INVALID_SCHEMA'
			});
		}
		
		if (!body.json_schema.type) {
			error(400, {
				message: 'json_schema must have a type property',
				code: 'MISSING_SCHEMA_TYPE'
			});
		}
		
		const request: CreateStructuredOutputRequest = {
			name: body.name,
			description: body.description,
			json_schema: body.json_schema,
			example_output: body.example_output,
			is_public: body.is_public || false
		};
		
		const schema = await createStructuredOutput(auth.user_id, request);
		return schema;
	},
	{ required_scope: 'write' }
);