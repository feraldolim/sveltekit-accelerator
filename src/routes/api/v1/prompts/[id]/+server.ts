import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { createApiHandler } from '$lib/server/api-middleware.js';
import { requireAuth } from '$lib/server/auth.js';
import {
	getSystemPrompt,
	updateSystemPrompt,
	deleteSystemPrompt,
	forkSystemPrompt
} from '$lib/server/system-prompts.js';

// GET /api/v1/prompts/:id - Get specific system prompt
export const GET: RequestHandler = createApiHandler(
	async (event, auth) => {
		const promptId = event.params.id!;
		
		const prompt = await getSystemPrompt(auth.user_id, promptId);
		if (!prompt) {
			error(404, {
				message: 'System prompt not found',
				code: 'PROMPT_NOT_FOUND'
			});
		}
		
		return prompt;
	},
	{ required_scope: 'read' }
);

// PUT /api/v1/prompts/:id - Update system prompt
export const PUT: RequestHandler = async (event) => {
	const authHeader = event.request.headers.get('authorization');
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		const promptId = event.params.id!;
		const body = await event.request.json();
		
		const allowedFields = ['name', 'description', 'content', 'variables', 'category', 'is_public'];
		const updateFields = Object.keys(body).filter(key => allowedFields.includes(key));
		
		if (updateFields.length === 0) {
			error(400, { message: `No valid update fields provided. Allowed fields: ${allowedFields.join(', ')}` });
		}
		
		const updates: any = {};
		for (const field of updateFields) {
			updates[field] = body[field];
		}
		
		// Validate variables if provided
		if (updates.variables) {
			if (typeof updates.variables !== 'object' || Array.isArray(updates.variables)) {
				error(400, { message: 'Variables must be an object' });
			}
			
			for (const [name, variable] of Object.entries(updates.variables)) {
				if (!variable || typeof variable !== 'object') {
					error(400, { message: `Variable '${name}' must be an object` });
				}
				
				const v = variable as any;
				if (!v.type || !['string', 'number', 'boolean', 'array', 'object'].includes(v.type)) {
					error(400, { message: `Variable '${name}' must have a valid type` });
				}
			}
		}
		
		const updatedPrompt = await updateSystemPrompt(session.user.id, promptId, updates);
		return json(updatedPrompt);
	} else {
		// Use API key auth for external requests
		return createApiHandler(
			async (event, auth) => {
				const promptId = event.params.id!;
				const body = await event.request.json();
				
				const allowedFields = ['name', 'description', 'content', 'variables', 'category', 'is_public'];
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
				
				// Validate variables if provided
				if (updates.variables) {
					if (typeof updates.variables !== 'object' || Array.isArray(updates.variables)) {
						error(400, {
							message: 'Variables must be an object',
							code: 'INVALID_VARIABLES'
						});
					}
					
					for (const [name, variable] of Object.entries(updates.variables)) {
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
				
				const updatedPrompt = await updateSystemPrompt(auth.user_id, promptId, updates);
				return updatedPrompt;
			},
			{ required_scope: 'write' }
		)(event);
	}
};

// DELETE /api/v1/prompts/:id - Delete system prompt
export const DELETE: RequestHandler = async (event) => {
	const authHeader = event.request.headers.get('authorization');
	
	if (!authHeader) {
		// Use session-based auth for developer console
		const session = await requireAuth(event);
		const promptId = event.params.id!;
		
		await deleteSystemPrompt(session.user.id, promptId);
		
		return json({ deleted: true });
	} else {
		// Use API key auth for external requests
		return createApiHandler(
			async (event, auth) => {
				const promptId = event.params.id!;
				
				await deleteSystemPrompt(auth.user_id, promptId);
				
				return {
					deleted: true
				};
			},
			{ required_scope: 'delete' }
		)(event);
	}
};