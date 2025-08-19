import { supabaseAdmin } from './supabase.js';
import Ajv, { type JSONSchemaType } from 'ajv';
import addFormats from 'ajv-formats';
import { createCompletion, createCompletionStream, type ChatMessage, type CompletionRequest } from './llm.js';

export interface StructuredOutput {
	id: string;
	user_id: string;
	name: string;
	description?: string;
	json_schema: any; // JSON Schema object
	example_output?: any;
	is_public: boolean;
	usage_count: number;
	version: number;
	is_latest: boolean;
	parent_id?: string;
	created_at: string;
	updated_at: string;
}

export interface StructuredOutputVersion {
	id: string;
	output_id: string;
	version: number;
	name: string;
	description?: string;
	json_schema: any;
	example_output?: any;
	is_public: boolean;
	changed_by: string;
	change_summary?: string;
	created_at: string;
}

export interface CreateStructuredOutputRequest {
	name: string;
	description?: string;
	json_schema: any;
	example_output?: any;
	is_public?: boolean;
}

export interface StructuredCompletionRequest extends Omit<CompletionRequest, 'stream'> {
	schema_id?: string;
	schema?: any; // Direct JSON Schema
	strict?: boolean;
	max_retries?: number;
	return_raw_response?: boolean;
}

export interface StructuredCompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	structured_output: any;
	raw_response?: string;
	validation_errors?: string[];
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
	retries_used?: number;
}

// Initialize AJV validator
const ajv = new Ajv({ 
	allErrors: true, 
	verbose: true,
	strict: false // Allow additional properties not defined in schema
});
addFormats(ajv);

/**
 * Create a new structured output schema
 */
export async function createStructuredOutput(
	userId: string,
	request: CreateStructuredOutputRequest
): Promise<StructuredOutput> {
	// Validate the JSON schema itself
	try {
		ajv.compile(request.json_schema);
	} catch (error) {
		throw new Error(`Invalid JSON Schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}

	const outputData = {
		user_id: userId,
		name: request.name,
		description: request.description || null,
		json_schema: request.json_schema,
		example_output: request.example_output || null,
		is_public: request.is_public || false,
		usage_count: 0
	};

	const { data, error } = await supabaseAdmin
		.from('structured_outputs')
		.insert([outputData])
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to create structured output: ${error.message}`);
	}

	return data;
}

/**
 * List structured outputs for a user (including public ones)
 */
export async function listStructuredOutputs(
	userId: string,
	options?: {
		include_public?: boolean;
		search?: string;
		limit?: number;
		offset?: number;
	}
): Promise<StructuredOutput[]> {
	let query = supabaseAdmin
		.from('structured_outputs')
		.select('*');

	// Filter by ownership or public
	if (options?.include_public !== false) {
		query = query.or(`user_id.eq.${userId},is_public.eq.true`);
	} else {
		query = query.eq('user_id', userId);
	}

	// Search in name and description
	if (options?.search) {
		query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`);
	}

	// Pagination
	if (options?.limit) {
		query = query.limit(options.limit);
	}
	if (options?.offset) {
		query = query.range(options.offset, (options.offset + (options.limit || 10)) - 1);
	}

	query = query.order('created_at', { ascending: false });

	const { data, error } = await query;

	if (error) {
		throw new Error(`Failed to list structured outputs: ${error.message}`);
	}

	return data || [];
}

/**
 * Get structured output by ID
 */
export async function getStructuredOutput(
	userId: string,
	outputId: string,
	allowPublic: boolean = true
): Promise<StructuredOutput | null> {
	let query = supabaseAdmin
		.from('structured_outputs')
		.select('*')
		.eq('id', outputId);

	if (allowPublic) {
		query = query.or(`user_id.eq.${userId},is_public.eq.true`);
	} else {
		query = query.eq('user_id', userId);
	}

	const { data, error } = await query.single();

	if (error) {
		if (error.code === 'PGRST116') return null; // Not found
		throw new Error(`Failed to get structured output: ${error.message}`);
	}

	return data;
}

/**
 * Update structured output (creates a new version)
 */
export async function updateStructuredOutput(
	userId: string,
	outputId: string,
	updates: Partial<Pick<StructuredOutput, 'name' | 'description' | 'json_schema' | 'example_output' | 'is_public'>>,
	changeSummary?: string
): Promise<StructuredOutput> {
	// Validate new schema if provided
	if (updates.json_schema) {
		try {
			ajv.compile(updates.json_schema);
		} catch (error) {
			throw new Error(`Invalid JSON Schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	// Get the current output
	const currentOutput = await getStructuredOutput(userId, outputId, false);
	if (!currentOutput) {
		throw new Error('Structured output not found');
	}
	
	// Ensure version is set (default to 1 for existing records without version)
	if (!currentOutput.version) {
		currentOutput.version = 1;
	}
	
	console.log('Current output version:', currentOutput.version);

	// Check if there are any actual changes
	const hasChanges = Object.keys(updates).some(key => {
		const currentValue = currentOutput[key as keyof StructuredOutput];
		const newValue = updates[key as keyof typeof updates];
		return JSON.stringify(currentValue) !== JSON.stringify(newValue);
	});

	if (!hasChanges) {
		return currentOutput; // No changes, return current output
	}

	// Check if version record already exists for this version
	const { data: existingVersion } = await supabaseAdmin
		.from('structured_output_versions')
		.select('id')
		.eq('output_id', currentOutput.id)
		.eq('version', currentOutput.version || 1)
		.single();
	
	// Only create version record if it doesn't exist
	if (!existingVersion) {
		const versionData = {
			output_id: currentOutput.id,
			version: currentOutput.version || 1,
			name: currentOutput.name,
			description: currentOutput.description,
			json_schema: currentOutput.json_schema,
			example_output: currentOutput.example_output,
			is_public: currentOutput.is_public,
			changed_by: userId,
			change_summary: changeSummary || 'Updated structured output'
		};
		
		console.log('Inserting version data:', JSON.stringify(versionData, null, 2));
		
		const { error: versionError } = await supabaseAdmin
			.from('structured_output_versions')
			.insert(versionData);

		if (versionError) {
			console.error('Version creation error:', versionError);
			throw new Error(`Failed to create version record: ${versionError.message || JSON.stringify(versionError)}`);
		}
	} else {
		console.log('Version record already exists, skipping creation');
	}

	// Update the output with new version
	const { data, error } = await supabaseAdmin
		.from('structured_outputs')
		.update({
			...updates,
			version: currentOutput.version + 1,
			updated_at: new Date().toISOString()
		})
		.eq('id', outputId)
		.eq('user_id', userId)
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to update structured output: ${error.message}`);
	}

	return data;
}

/**
 * Delete structured output
 */
export async function deleteStructuredOutput(userId: string, outputId: string): Promise<boolean> {
	const { error } = await supabaseAdmin
		.from('structured_outputs')
		.delete()
		.eq('id', outputId)
		.eq('user_id', userId);

	if (error) {
		throw new Error(`Failed to delete structured output: ${error.message}`);
	}

	return true;
}

/**
 * Validate data against JSON schema
 */
export function validateStructuredData(data: any, schema: any): {
	valid: boolean;
	errors: string[];
	data?: any;
} {
	try {
		const validate = ajv.compile(schema);
		const valid = validate(data);

		if (valid) {
			return { valid: true, errors: [], data };
		}

		const errors = validate.errors?.map(error => {
			const path = error.instancePath || 'root';
			const message = error.message || 'Invalid data';
			return `${path}: ${message}`;
		}) || [];

		return { valid: false, errors };
	} catch (error) {
		return {
			valid: false,
			errors: [`Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
		};
	}
}

/**
 * Parse JSON response safely
 */
function parseJsonResponse(response: string): { success: boolean; data?: any; error?: string } {
	try {
		// Try to find JSON in the response (handles cases where AI adds extra text)
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const data = JSON.parse(jsonMatch[0]);
			return { success: true, data };
		}

		// Try parsing the entire response
		const data = JSON.parse(response);
		return { success: true, data };
	} catch (error) {
		return {
			success: false,
			error: `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Create structured completion with validation
 */
export async function createStructuredCompletion(
	request: StructuredCompletionRequest
): Promise<StructuredCompletionResponse> {
	let schema: any;

	// Get schema from ID or use direct schema
	if (request.schema_id && request.user_id) {
		const structuredOutput = await getStructuredOutput(request.user_id, request.schema_id);
		if (!structuredOutput) {
			throw new Error('Structured output schema not found');
		}
		schema = structuredOutput.json_schema;

		// Increment usage count
		await supabaseAdmin
			.from('structured_outputs')
			.update({
				usage_count: structuredOutput.usage_count + 1,
				updated_at: new Date().toISOString()
			})
			.eq('id', request.schema_id);
	} else if (request.schema) {
		schema = request.schema;
	} else {
		throw new Error('Either schema_id or schema must be provided');
	}

	const maxRetries = request.max_retries || 3;
	const strict = request.strict !== false; // Default to strict
	let retriesUsed = 0;
	let lastError: string | undefined;

	// Build completion request with JSON format instruction
	const systemMessage: ChatMessage = {
		role: 'system',
		content: `You must respond with valid JSON that matches the following schema:

${JSON.stringify(schema, null, 2)}

${request.example_output ? `Example output:
${JSON.stringify(request.example_output, null, 2)}

` : ''}IMPORTANT: Respond only with valid JSON. Do not include any explanations or additional text outside the JSON object.`
	};

	const completionRequest: CompletionRequest = {
		messages: [systemMessage, ...request.messages],
		model: request.model,
		temperature: request.temperature,
		max_tokens: request.max_tokens,
		top_p: request.top_p,
		frequency_penalty: request.frequency_penalty,
		presence_penalty: request.presence_penalty,
		apiKey: request.apiKey
	};

	// Add response_format if the model supports it
	const supportsStructuredOutput = ['openai/', 'anthropic/'].some(prefix => 
		completionRequest.model?.startsWith(prefix)
	);

	if (supportsStructuredOutput) {
		(completionRequest as any).response_format = { type: 'json_object' };
	}

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		retriesUsed = attempt;

		try {
			const completion = await createCompletion(completionRequest);
			const rawResponse = completion.choices[0]?.message?.content || '';

			// Parse JSON response
			const parseResult = parseJsonResponse(rawResponse);
			if (!parseResult.success) {
				lastError = parseResult.error;
				if (attempt < maxRetries) continue;
				
				if (strict) {
					throw new Error(`Failed to parse JSON response after ${maxRetries + 1} attempts: ${parseResult.error}`);
				}
				
				// Return raw response if not strict
				return {
					id: completion.id,
					object: completion.object,
					created: completion.created,
					model: completion.model,
					structured_output: null,
					raw_response: rawResponse,
					validation_errors: [parseResult.error || 'Failed to parse JSON'],
					usage: completion.usage,
					retries_used: retriesUsed
				};
			}

			// Validate against schema
			const validation = validateStructuredData(parseResult.data, schema);
			if (validation.valid) {
				return {
					id: completion.id,
					object: completion.object,
					created: completion.created,
					model: completion.model,
					structured_output: validation.data,
					raw_response: request.return_raw_response ? rawResponse : undefined,
					usage: completion.usage,
					retries_used: retriesUsed
				};
			}

			lastError = validation.errors.join('; ');
			if (attempt < maxRetries) {
				// Add validation feedback to the next attempt
				completionRequest.messages.push({
					role: 'user',
					content: `The previous response had validation errors: ${lastError}. Please provide a corrected JSON response that strictly follows the schema.`
				});
				continue;
			}

			if (strict) {
				throw new Error(`Response validation failed after ${maxRetries + 1} attempts: ${lastError}`);
			}

			// Return with validation errors if not strict
			return {
				id: completion.id,
				object: completion.object,
				created: completion.created,
				model: completion.model,
				structured_output: parseResult.data,
				raw_response: request.return_raw_response ? rawResponse : undefined,
				validation_errors: validation.errors,
				usage: completion.usage,
				retries_used: retriesUsed
			};

		} catch (error) {
			lastError = error instanceof Error ? error.message : 'Unknown error';
			if (attempt < maxRetries) continue;
			
			throw new Error(`Structured completion failed after ${maxRetries + 1} attempts: ${lastError}`);
		}
	}

	throw new Error(`Structured completion failed: ${lastError}`);
}

/**
 * Get popular/trending structured outputs
 */
export async function getTrendingStructuredOutputs(limit: number = 10): Promise<StructuredOutput[]> {
	const { data, error } = await supabaseAdmin
		.from('structured_outputs')
		.select('*')
		.eq('is_public', true)
		.order('usage_count', { ascending: false })
		.limit(limit);

	if (error) {
		throw new Error(`Failed to get trending structured outputs: ${error.message}`);
	}

	return data || [];
}

/**
 * Fork a structured output schema
 */
export async function forkStructuredOutput(
	userId: string,
	outputId: string,
	newName?: string
): Promise<StructuredOutput> {
	// Get the original schema
	const original = await getStructuredOutput(userId, outputId, true);
	if (!original) {
		throw new Error('Structured output not found');
	}

	// Create new schema based on original
	const forkData = {
		user_id: userId,
		name: newName || `${original.name} (Copy)`,
		description: `Forked from: ${original.name}`,
		json_schema: original.json_schema,
		example_output: original.example_output,
		is_public: false, // Forks are private by default
		usage_count: 0
	};

	const { data, error } = await supabaseAdmin
		.from('structured_outputs')
		.insert([forkData])
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to fork structured output: ${error.message}`);
	}

	return data;
}

/**
 * Generate example schemas for common use cases
 */
export const EXAMPLE_SCHEMAS = {
	sentiment_analysis: {
		name: 'Sentiment Analysis',
		description: 'Analyze text sentiment and extract key emotions',
		json_schema: {
			type: 'object',
			properties: {
				sentiment: {
					type: 'string',
					enum: ['positive', 'negative', 'neutral']
				},
				confidence: {
					type: 'number',
					minimum: 0,
					maximum: 1
				},
				emotions: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							emotion: { type: 'string' },
							intensity: { type: 'number', minimum: 0, maximum: 1 }
						},
						required: ['emotion', 'intensity']
					}
				},
				summary: { type: 'string' }
			},
			required: ['sentiment', 'confidence', 'summary']
		},
		example_output: {
			sentiment: 'positive',
			confidence: 0.85,
			emotions: [
				{ emotion: 'joy', intensity: 0.8 },
				{ emotion: 'excitement', intensity: 0.6 }
			],
			summary: 'The text expresses positive sentiment with high confidence.'
		}
	},

	product_review: {
		name: 'Product Review Analysis',
		description: 'Extract structured data from product reviews',
		json_schema: {
			type: 'object',
			properties: {
				rating: { type: 'integer', minimum: 1, maximum: 5 },
				pros: {
					type: 'array',
					items: { type: 'string' }
				},
				cons: {
					type: 'array',
					items: { type: 'string' }
				},
				categories: {
					type: 'array',
					items: {
						type: 'string',
						enum: ['quality', 'price', 'shipping', 'customer_service', 'usability', 'design']
					}
				},
				recommendation: { type: 'boolean' },
				summary: { type: 'string', maxLength: 500 }
			},
			required: ['rating', 'recommendation', 'summary']
		}
	},

	meeting_minutes: {
		name: 'Meeting Minutes',
		description: 'Structure meeting notes into actionable items',
		json_schema: {
			type: 'object',
			properties: {
				meeting_title: { type: 'string' },
				date: { type: 'string', format: 'date' },
				attendees: {
					type: 'array',
					items: { type: 'string' }
				},
				agenda_items: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							topic: { type: 'string' },
							discussion_points: {
								type: 'array',
								items: { type: 'string' }
							},
							decisions: {
								type: 'array',
								items: { type: 'string' }
							}
						},
						required: ['topic']
					}
				},
				action_items: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							task: { type: 'string' },
							assignee: { type: 'string' },
							due_date: { type: 'string', format: 'date' },
							priority: {
								type: 'string',
								enum: ['low', 'medium', 'high']
							}
						},
						required: ['task', 'assignee']
					}
				}
			},
			required: ['meeting_title', 'attendees', 'agenda_items']
		}
	}
};

/**
 * Get version history for a structured output
 */
export async function getOutputVersions(
	userId: string,
	outputId: string
): Promise<StructuredOutputVersion[]> {
	// Verify user has access to this output
	const output = await getStructuredOutput(userId, outputId, false);
	if (!output) {
		throw new Error('Structured output not found');
	}

	const { data, error } = await supabaseAdmin
		.from('structured_output_versions')
		.select('*')
		.eq('output_id', outputId)
		.order('version', { ascending: false });

	if (error) {
		throw new Error(`Failed to get output versions: ${error.message}`);
	}

	return data || [];
}

/**
 * Restore a structured output to a previous version
 */
export async function restoreOutputVersion(
	userId: string,
	outputId: string,
	version: number,
	changeSummary?: string
): Promise<StructuredOutput> {
	// Get the version to restore
	const { data: versionData, error: versionError } = await supabaseAdmin
		.from('structured_output_versions')
		.select('*')
		.eq('output_id', outputId)
		.eq('version', version)
		.single();

	if (versionError || !versionData) {
		throw new Error('Version not found');
	}

	// Verify user has access to this output
	const currentOutput = await getStructuredOutput(userId, outputId, false);
	if (!currentOutput) {
		throw new Error('Structured output not found');
	}

	// Create a new version with the restored content
	return updateStructuredOutput(
		userId,
		outputId,
		{
			name: versionData.name,
			description: versionData.description,
			json_schema: versionData.json_schema,
			example_output: versionData.example_output,
			is_public: versionData.is_public
		},
		changeSummary || `Restored to version ${version}`
	);
}

/**
 * Get version comparison data
 */
export async function compareOutputVersions(
	userId: string,
	outputId: string,
	version1: number,
	version2: number
): Promise<{
	version1: StructuredOutputVersion | StructuredOutput;
	version2: StructuredOutputVersion | StructuredOutput;
}> {
	// Verify user has access to this output
	const output = await getStructuredOutput(userId, outputId, false);
	if (!output) {
		throw new Error('Structured output not found');
	}

	// Get the versions
	const [v1Data, v2Data] = await Promise.all([
		version1 === output.version 
			? Promise.resolve(output)
			: supabaseAdmin
				.from('structured_output_versions')
				.select('*')
				.eq('output_id', outputId)
				.eq('version', version1)
				.single()
				.then(({ data, error }) => {
					if (error) throw new Error(`Version ${version1} not found`);
					return data;
				}),
		version2 === output.version
			? Promise.resolve(output)
			: supabaseAdmin
				.from('structured_output_versions')
				.select('*')
				.eq('output_id', outputId)
				.eq('version', version2)
				.single()
				.then(({ data, error }) => {
					if (error) throw new Error(`Version ${version2} not found`);
					return data;
				})
	]);

	return {
		version1: v1Data,
		version2: v2Data
	};
}