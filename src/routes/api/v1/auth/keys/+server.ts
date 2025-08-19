import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { 
	createApiHandler, 
	validateRequestBody, 
	validateQueryParams,
	parsePagination,
	createApiResponse
} from '$lib/server/api-middleware.js';
import {
	createApiKey,
	listApiKeys,
	updateApiKey,
	getApiUsageStats,
	type CreateApiKeyRequest
} from '$lib/server/api-keys.js';

// GET /api/v1/auth/keys - List API keys
export const GET: RequestHandler = async (event) => {
	// Check if this is a session-based request (from developer console)
	const authHeader = event.request.headers.get('authorization');
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		
		try {
			const url = new URL(event.request.url);
			const keys = await listApiKeys(session.user.id);
			
			return json({ apiKeys: keys });
		} catch (error) {
			console.error('Error fetching API keys:', error);
			return json({ error: 'Failed to fetch API keys' }, { status: 500 });
		}
	} else {
		// Use API key auth for external requests
		return createApiHandler(
			async (event, auth) => {
				const url = new URL(event.request.url);
				validateQueryParams(url, ['limit', 'offset', 'page']);
				
				const { limit, offset } = parsePagination(url);
				
				const keys = await listApiKeys(auth.user_id);
				
				// Apply pagination
				const paginatedKeys = keys.slice(offset, offset + limit);
				
				return createApiResponse(paginatedKeys, {
					total: keys.length,
					limit,
					offset
				});
			},
			{ required_scope: 'read' }
		)(event);
	}
};

// POST /api/v1/auth/keys - Create API key
export const POST: RequestHandler = async (event) => {
	// Check if this is a session-based request (from developer console)
	const authHeader = event.request.headers.get('authorization');
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		
		try {
			const body = await event.request.json();
			
			if (!body.name?.trim()) {
				return json({ error: 'Name is required' }, { status: 400 });
			}
			
			const request: CreateApiKeyRequest = {
				name: body.name,
				scopes: body.scopes || ['read', 'write'],
				rate_limit: body.rate_limit || 1000,
				expires_at: body.expires_at
			};
			
			// Validate scopes
			const validScopes = [
				// Legacy scopes
				'read', 'write', 'delete', '*',
				// Resource-specific scopes
				'system-prompts:read', 'system-prompts:write',
				'structured-outputs:read', 'structured-outputs:write',
				'api-keys:read', 'api-keys:write',
				'files:read', 'files:write',
				'conversations:read', 'conversations:write'
			];
			const invalidScopes = request.scopes?.filter(scope => !validScopes.includes(scope));
			if (invalidScopes && invalidScopes.length > 0) {
				return json({ error: `Invalid scopes: ${invalidScopes.join(', ')}` }, { status: 400 });
			}
			
			const result = await createApiKey(session.user.id, request);
			
			return json({
				id: result.apiKey.id,
				name: result.apiKey.name,
				key: result.apiKey.key, // Only returned on creation
				scopes: result.apiKey.scopes,
				rate_limit: result.apiKey.rate_limit,
				expires_at: result.apiKey.expires_at,
				created_at: result.apiKey.created_at
			});
		} catch (error) {
			console.error('Error creating API key:', error);
			return json({ error: 'Failed to create API key' }, { status: 500 });
		}
	} else {
		// Use API key auth for external requests
		return createApiHandler(
			async (event, auth) => {
				const body = await event.request.json();
				validateRequestBody(body, ['name']);
				
				const request: CreateApiKeyRequest = {
					name: body.name,
					scopes: body.scopes || ['read', 'write'],
					rate_limit: body.rate_limit || 100,
					expires_at: body.expires_at
				};
				
				// Validate scopes
				const validScopes = [
					// Legacy scopes
					'read', 'write', 'delete', '*',
					// Resource-specific scopes
					'system-prompts:read', 'system-prompts:write',
					'structured-outputs:read', 'structured-outputs:write',
					'api-keys:read', 'api-keys:write',
					'files:read', 'files:write',
					'conversations:read', 'conversations:write'
				];
				const invalidScopes = request.scopes?.filter(scope => !validScopes.includes(scope));
				if (invalidScopes && invalidScopes.length > 0) {
					error(400, {
						message: `Invalid scopes: ${invalidScopes.join(', ')}`,
						code: 'INVALID_SCOPES'
					});
				}
				
				// Validate rate limit
				if (request.rate_limit && (request.rate_limit < 1 || request.rate_limit > 10000)) {
					error(400, {
						message: 'Rate limit must be between 1 and 10000',
						code: 'INVALID_RATE_LIMIT'
					});
				}
				
				const result = await createApiKey(auth.user_id, request);
				
				return {
					id: result.apiKey.id,
					name: result.apiKey.name,
					key: result.apiKey.key, // Only returned on creation
					scopes: result.apiKey.scopes,
					rate_limit: result.apiKey.rate_limit,
					expires_at: result.apiKey.expires_at,
					created_at: result.apiKey.created_at
				};
			},
			{ required_scope: 'write' }
		)(event);
	}
};