import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { 
	createApiHandler, 
	validateRequestBody
} from '$lib/server/api-middleware.js';
import {
	getApiKey,
	updateApiKey,
	revokeApiKey,
	deleteApiKey
} from '$lib/server/api-keys.js';

// GET /api/v1/auth/keys/:id - Get specific API key
export const GET: RequestHandler = createApiHandler(
	async (event, auth) => {
		const keyId = event.params.id!;
		
		const apiKey = await getApiKey(auth.user_id, keyId);
		if (!apiKey) {
			error(404, {
				message: 'API key not found',
				code: 'KEY_NOT_FOUND'
			});
		}
		
		return apiKey;
	},
	{ required_scope: 'read' }
);

// PUT /api/v1/auth/keys/:id - Update API key
export const PUT: RequestHandler = createApiHandler(
	async (event, auth) => {
		const keyId = event.params.id!;
		const body = await event.request.json();
		
		// Validate allowed update fields
		const allowedFields = ['name', 'scopes', 'rate_limit', 'expires_at', 'is_active'];
		const updateFields = Object.keys(body).filter(key => allowedFields.includes(key));
		
		if (updateFields.length === 0) {
			error(400, {
				message: `No valid update fields provided. Allowed fields: ${allowedFields.join(', ')}`,
				code: 'NO_UPDATE_FIELDS'
			});
		}
		
		const updates: any = {};
		for (const field of updateFields) {
			updates[field] = body[field];
		}
		
		// Validate scopes if provided
		if (updates.scopes) {
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
			const invalidScopes = updates.scopes.filter((scope: string) => !validScopes.includes(scope));
			if (invalidScopes.length > 0) {
				error(400, {
					message: `Invalid scopes: ${invalidScopes.join(', ')}`,
					code: 'INVALID_SCOPES'
				});
			}
		}
		
		// Validate rate limit if provided
		if (updates.rate_limit && (updates.rate_limit < 1 || updates.rate_limit > 10000)) {
			error(400, {
				message: 'Rate limit must be between 1 and 10000',
				code: 'INVALID_RATE_LIMIT'
			});
		}
		
		const updatedKey = await updateApiKey(auth.user_id, keyId, updates);
		return updatedKey;
	},
	{ required_scope: 'write' }
);

// DELETE /api/v1/auth/keys/:id - Delete/revoke API key
export const DELETE: RequestHandler = async (event) => {
	// Check if this is a session-based request (from developer console)
	const authHeader = event.request.headers.get('authorization');
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		const { id } = event.params;
		
		try {
			const url = new URL(event.request.url);
			const permanent = url.searchParams.get('permanent') === 'true';
			
			if (permanent) {
				// Permanently delete the key
				await deleteApiKey(session.user.id, id!);
			} else {
				// Just revoke (deactivate) the key
				await revokeApiKey(session.user.id, id!);
			}
			
			return json({
				deleted: true,
				permanent
			});
		} catch (error) {
			console.error('Error deleting API key:', error);
			return json({ error: 'Failed to delete API key' }, { status: 500 });
		}
	} else {
		// Use API key auth for external requests
		return createApiHandler(
			async (event, auth) => {
				const keyId = event.params.id!;
				const url = new URL(event.request.url);
				const permanent = url.searchParams.get('permanent') === 'true';
				
				if (permanent) {
					// Permanently delete the key
					await deleteApiKey(auth.user_id, keyId);
				} else {
					// Just revoke (deactivate) the key
					await revokeApiKey(auth.user_id, keyId);
				}
				
				return {
					deleted: true,
					permanent
				};
			},
			{ required_scope: 'delete' }
		)(event);
	}
};