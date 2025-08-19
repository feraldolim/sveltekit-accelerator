import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { createApiHandler } from '$lib/server/api-middleware.js';
import {
	getStructuredOutput,
	updateStructuredOutput,
	deleteStructuredOutput,
	forkStructuredOutput
} from '$lib/server/structured-outputs.js';

// GET /api/v1/schemas/:id - Get specific structured output schema
export const GET: RequestHandler = createApiHandler(
	async (event, auth) => {
		const schemaId = event.params.id!;
		
		const schema = await getStructuredOutput(auth.user_id, schemaId);
		if (!schema) {
			error(404, {
				message: 'Structured output schema not found',
				code: 'SCHEMA_NOT_FOUND'
			});
		}
		
		return schema;
	},
	{ required_scope: 'read' }
);

// PUT /api/v1/schemas/:id - Update structured output schema
export const PUT: RequestHandler = createApiHandler(
	async (event, auth) => {
		const schemaId = event.params.id!;
		const body = await event.request.json();
		
		const allowedFields = ['name', 'description', 'json_schema', 'example_output', 'is_public'];
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
		
		// Validate JSON schema if provided
		if (updates.json_schema) {
			if (!updates.json_schema || typeof updates.json_schema !== 'object') {
				error(400, {
					message: 'json_schema must be a valid object',
					code: 'INVALID_SCHEMA'
				});
			}
			
			if (!updates.json_schema.type) {
				error(400, {
					message: 'json_schema must have a type property',
					code: 'MISSING_SCHEMA_TYPE'
				});
			}
		}
		
		const updatedSchema = await updateStructuredOutput(auth.user_id, schemaId, updates);
		return updatedSchema;
	},
	{ required_scope: 'write' }
);

// DELETE /api/v1/schemas/:id - Delete structured output schema
export const DELETE: RequestHandler = createApiHandler(
	async (event, auth) => {
		const schemaId = event.params.id!;
		
		await deleteStructuredOutput(auth.user_id, schemaId);
		
		return {
			deleted: true
		};
	},
	{ required_scope: 'delete' }
);