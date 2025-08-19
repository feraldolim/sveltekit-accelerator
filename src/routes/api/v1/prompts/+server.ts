import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { 
	createApiHandler, 
	validateRequestBody, 
	validateQueryParams,
	parsePagination,
	createApiResponse
} from '$lib/server/api-middleware.js';
import { requireAuth } from '$lib/server/auth.js';
import {
	createSystemPrompt,
	listSystemPrompts,
	getTrendingPrompts,
	getPromptCategories,
	type CreateSystemPromptRequest
} from '$lib/server/system-prompts.js';

// GET /api/v1/prompts - List system prompts
export const GET: RequestHandler = async (event) => {
	const authHeader = event.request.headers.get('authorization');
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		const url = new URL(event.request.url);
		
		const category = url.searchParams.get('category') || undefined;
		const search = url.searchParams.get('search') || undefined;
		const trending = url.searchParams.get('trending') === 'true';
		const limit = parseInt(url.searchParams.get('limit') || '50');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const includePublic = url.searchParams.get('include_public') !== 'false';
		
		let prompts;
		
		if (trending) {
			prompts = await getTrendingPrompts(limit);
		} else {
			prompts = await listSystemPrompts(session.user.id, {
				category,
				include_public: includePublic,
				search,
				limit,
				offset
			});
		}
		
		return json({
			data: prompts,
			meta: {
				total: prompts.length,
				limit,
				offset
			}
		});
	} else {
		// Use API key auth for external requests
		return createApiHandler(
			async (event, auth) => {
				const url = new URL(event.request.url);
				validateQueryParams(url, ['limit', 'offset', 'page', 'category', 'include_public', 'search', 'trending']);
				
				const { limit, offset } = parsePagination(url);
				const category = url.searchParams.get('category') || undefined;
				const includePublic = url.searchParams.get('include_public') !== 'false';
				const search = url.searchParams.get('search') || undefined;
				const trending = url.searchParams.get('trending') === 'true';
				
				let prompts;
				
				if (trending) {
					prompts = await getTrendingPrompts(limit);
				} else {
					prompts = await listSystemPrompts(auth.user_id, {
						category,
						include_public: includePublic,
						search,
						limit,
						offset
					});
				}
				
				return createApiResponse(prompts, {
					total: prompts.length,
					limit,
					offset
				});
			},
			{ required_scope: 'read' }
		)(event);
	}
};

// POST /api/v1/prompts - Create system prompt
export const POST: RequestHandler = async (event) => {
	const authHeader = event.request.headers.get('authorization');
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		const body = await event.request.json();
		
		if (!body.name || !body.content) {
			error(400, { message: 'Name and content are required' });
		}
		
		// Validate variables schema if provided
		if (body.variables) {
			if (typeof body.variables !== 'object' || Array.isArray(body.variables)) {
				error(400, { message: 'Variables must be an object' });
			}
			
			// Validate each variable definition
			for (const [name, variable] of Object.entries(body.variables)) {
				if (!variable || typeof variable !== 'object') {
					error(400, { message: `Variable '${name}' must be an object` });
				}
				
				const v = variable as any;
				if (!v.type || !['string', 'number', 'boolean', 'array', 'object'].includes(v.type)) {
					error(400, { message: `Variable '${name}' must have a valid type` });
				}
			}
		}
		
		const request: CreateSystemPromptRequest = {
			name: body.name,
			description: body.description,
			content: body.content,
			variables: body.variables,
			category: body.category,
			is_public: body.is_public || false
		};
		
		const prompt = await createSystemPrompt(session.user.id, request);
		return json(prompt);
	} else {
		// Use API key auth for external requests
		return createApiHandler(
			async (event, auth) => {
				const body = await event.request.json();
				validateRequestBody(body, ['name', 'content']);
				
				// Validate variables schema if provided
				if (body.variables) {
					if (typeof body.variables !== 'object' || Array.isArray(body.variables)) {
						error(400, {
							message: 'Variables must be an object',
							code: 'INVALID_VARIABLES'
						});
					}
					
					// Validate each variable definition
					for (const [name, variable] of Object.entries(body.variables)) {
						if (!variable || typeof variable !== 'object') {
							error(400, {
								message: `Variable '${name}' must be an object`,
								code: 'INVALID_VARIABLE_DEFINITION'
							});
						}
						
						const v = variable as any;
						if (!v.type || !['string', 'number', 'boolean', 'array', 'object'].includes(v.type)) {
							error(400, {
								message: `Variable '${name}' must have a valid type`,
								code: 'INVALID_VARIABLE_TYPE'
							});
						}
					}
				}
				
				const request: CreateSystemPromptRequest = {
					name: body.name,
					description: body.description,
					content: body.content,
					variables: body.variables,
					category: body.category,
					is_public: body.is_public || false
				};
				
				const prompt = await createSystemPrompt(auth.user_id, request);
				return prompt;
			},
			{ required_scope: 'write' }
		)(event);
	}
};