import { requireAuth } from '$lib/server/auth.js';
import { listStructuredOutputs } from '$lib/server/structured-outputs.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { url } = event;
	const session = await requireAuth(event);
	
	const search = url.searchParams.get('search') || undefined;
	
	try {
		const schemas = await listStructuredOutputs(session.user.id, {
			search,
			limit: 50
		});
		
		// Process schemas to add validation and match expected format
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
				is_valid: isValid,
				usage_count: schema.usage_count || 0
			};
		}) || [];
		
		return {
			schemas: processedSchemas,
			filters: {
				search
			}
		};
	} catch (error) {
		console.error('Error loading structured outputs:', error);
		return {
			schemas: [],
			filters: {
				search
			}
		};
	}
};