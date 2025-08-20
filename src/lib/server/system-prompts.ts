import { supabaseAdmin } from './supabase.js';

export interface SystemPrompt {
	id: string;
	user_id: string;
	name: string;
	description?: string;
	content: string;
	variables: Record<string, PromptVariable>;
	category: string;
	is_public: boolean;
	usage_count: number;
	version: number;
	is_latest: boolean;
	parent_id?: string;
	created_at: string;
	updated_at: string;
}

export interface SystemPromptVersion {
	id: string;
	prompt_id: string;
	version: number;
	name: string;
	description?: string;
	content: string;
	variables: Record<string, PromptVariable>;
	category: string;
	is_public: boolean;
	changed_by: string;
	change_summary?: string;
	created_at: string;
}

export interface PromptVariable {
	type: 'string' | 'number' | 'boolean' | 'array' | 'object';
	required: boolean;
	default?: any;
	description?: string;
	validation?: {
		min?: number;
		max?: number;
		pattern?: string;
		enum?: any[];
		minLength?: number;
		maxLength?: number;
	};
}

export interface CreateSystemPromptRequest {
	name: string;
	description?: string;
	content: string;
	variables?: Record<string, PromptVariable>;
	category?: string;
	is_public?: boolean;
}

export interface ExecutePromptRequest {
	variables?: Record<string, any>;
	validate_variables?: boolean;
}

export interface ExecutePromptResult {
	rendered_content: string;
	variables_used: Record<string, any>;
	validation_errors?: string[];
}

/**
 * Built-in template functions
 */
const TEMPLATE_FUNCTIONS = {
	NOW: () => new Date().toISOString().split('T')[0], // Current date YYYY-MM-DD
	NOW_TIME: () => new Date().toISOString(), // Current ISO timestamp
	TODAY: () => new Date().toISOString().split('T')[0],
	RANDOM_UUID: () => crypto.randomUUID(),
	UPPER: (text: string) => text?.toUpperCase() || '',
	LOWER: (text: string) => text?.toLowerCase() || '',
	CAPITALIZE: (text: string) => text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : '',
	TRUNCATE: (text: string, length: number = 100) => text && text.length > length ? text.substring(0, length) + '...' : text || ''
};

/**
 * Create a new system prompt
 */
export async function createSystemPrompt(
	userId: string,
	request: CreateSystemPromptRequest
): Promise<SystemPrompt> {
	const promptData = {
		user_id: userId,
		name: request.name,
		description: request.description || null,
		content: request.content,
		variables: request.variables || {},
		category: request.category || 'general',
		is_public: request.is_public || false,
		usage_count: 0
	};

	const { data, error } = await supabaseAdmin
		.from('system_prompts')
		.insert([promptData])
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to create system prompt: ${error.message}`);
	}

	return data;
}

/**
 * List system prompts for a user (including public ones)
 */
export async function listSystemPrompts(
	userId: string,
	options?: {
		category?: string;
		include_public?: boolean;
		search?: string;
		limit?: number;
		offset?: number;
	}
): Promise<SystemPrompt[]> {
	let query = supabaseAdmin
		.from('system_prompts')
		.select('*');

	// Filter by ownership or public
	if (options?.include_public !== false) {
		query = query.or(`user_id.eq.${userId},is_public.eq.true`);
	} else {
		query = query.eq('user_id', userId);
	}

	// Filter by category
	if (options?.category) {
		query = query.eq('category', options.category);
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
		throw new Error(`Failed to list system prompts: ${error.message}`);
	}

	return data || [];
}

/**
 * Get system prompt by ID
 */
export async function getSystemPrompt(
	userId: string,
	promptId: string,
	allowPublic: boolean = true
): Promise<SystemPrompt | null> {
	let query = supabaseAdmin
		.from('system_prompts')
		.select('*')
		.eq('id', promptId);

	if (allowPublic) {
		query = query.or(`user_id.eq.${userId},is_public.eq.true`);
	} else {
		query = query.eq('user_id', userId);
	}

	const { data, error } = await query.single();

	if (error) {
		if (error.code === 'PGRST116') return null; // Not found
		throw new Error(`Failed to get system prompt: ${error.message}`);
	}

	return data;
}

/**
 * Update system prompt (creates a new version)
 */
export async function updateSystemPrompt(
	userId: string,
	promptId: string,
	updates: Partial<Pick<SystemPrompt, 'name' | 'description' | 'content' | 'variables' | 'category' | 'is_public'>>,
	changeSummary?: string
): Promise<SystemPrompt> {
	// Get the current prompt
	const currentPrompt = await getSystemPrompt(userId, promptId, false);
	if (!currentPrompt) {
		throw new Error('System prompt not found');
	}

	// Check if there are any actual changes
	const hasChanges = Object.keys(updates).some(key => {
		const currentValue = currentPrompt[key as keyof SystemPrompt];
		const newValue = updates[key as keyof typeof updates];
		return JSON.stringify(currentValue) !== JSON.stringify(newValue);
	});

	if (!hasChanges) {
		return currentPrompt; // No changes, return current prompt
	}

	// Create a version record for the current state
	const { error: versionError } = await supabaseAdmin
		.from('system_prompt_versions')
		.insert({
			prompt_id: currentPrompt.id,
			version: currentPrompt.version,
			name: currentPrompt.name,
			description: currentPrompt.description,
			content: currentPrompt.content,
			variables: currentPrompt.variables,
			category: currentPrompt.category,
			is_public: currentPrompt.is_public,
			changed_by: userId,
			change_summary: changeSummary || 'Updated prompt'
		});

	if (versionError) {
		throw new Error(`Failed to create version record: ${versionError.message}`);
	}

	// Update the prompt with new version
	const { data, error } = await supabaseAdmin
		.from('system_prompts')
		.update({
			...updates,
			version: currentPrompt.version + 1,
			updated_at: new Date().toISOString()
		})
		.eq('id', promptId)
		.eq('user_id', userId)
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to update system prompt: ${error.message}`);
	}

	return data;
}

/**
 * Delete system prompt
 */
export async function deleteSystemPrompt(userId: string, promptId: string): Promise<boolean> {
	const { error } = await supabaseAdmin
		.from('system_prompts')
		.delete()
		.eq('id', promptId)
		.eq('user_id', userId);

	if (error) {
		throw new Error(`Failed to delete system prompt: ${error.message}`);
	}

	return true;
}

/**
 * Validate prompt variables against schema
 */
export function validatePromptVariables(
	variables: Record<string, any>,
	schema: Record<string, PromptVariable>
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Check required variables
	for (const [name, config] of Object.entries(schema)) {
		if (config.required && (variables[name] === undefined || variables[name] === null)) {
			errors.push(`Required variable '${name}' is missing`);
			continue;
		}

		const value = variables[name];
		if (value === undefined || value === null) continue;

		// Type validation
		switch (config.type) {
			case 'string':
				if (typeof value !== 'string') {
					errors.push(`Variable '${name}' must be a string`);
					break;
				}
				if (config.validation?.minLength && value.length < config.validation.minLength) {
					errors.push(`Variable '${name}' must be at least ${config.validation.minLength} characters`);
				}
				if (config.validation?.maxLength && value.length > config.validation.maxLength) {
					errors.push(`Variable '${name}' must be at most ${config.validation.maxLength} characters`);
				}
				if (config.validation?.pattern && !new RegExp(config.validation.pattern).test(value)) {
					errors.push(`Variable '${name}' does not match required pattern`);
				}
				if (config.validation?.enum && !config.validation.enum.includes(value)) {
					errors.push(`Variable '${name}' must be one of: ${config.validation.enum.join(', ')}`);
				}
				break;

			case 'number':
				if (typeof value !== 'number') {
					errors.push(`Variable '${name}' must be a number`);
					break;
				}
				if (config.validation?.min !== undefined && value < config.validation.min) {
					errors.push(`Variable '${name}' must be at least ${config.validation.min}`);
				}
				if (config.validation?.max !== undefined && value > config.validation.max) {
					errors.push(`Variable '${name}' must be at most ${config.validation.max}`);
				}
				break;

			case 'boolean':
				if (typeof value !== 'boolean') {
					errors.push(`Variable '${name}' must be a boolean`);
				}
				break;

			case 'array':
				if (!Array.isArray(value)) {
					errors.push(`Variable '${name}' must be an array`);
					break;
				}
				if (config.validation?.min && value.length < config.validation.min) {
					errors.push(`Variable '${name}' must have at least ${config.validation.min} items`);
				}
				if (config.validation?.max && value.length > config.validation.max) {
					errors.push(`Variable '${name}' must have at most ${config.validation.max} items`);
				}
				break;

			case 'object':
				if (typeof value !== 'object' || Array.isArray(value)) {
					errors.push(`Variable '${name}' must be an object`);
				}
				break;
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Render template with variables
 */
export function renderTemplate(
	content: string,
	variables: Record<string, any> = {},
	functions: Record<string, Function> = {}
): string {
	let rendered = content;

	// Merge built-in functions with custom functions
	const allFunctions = { ...TEMPLATE_FUNCTIONS, ...functions };

	// Replace function calls first ({{FUNCTION_NAME}} or {{FUNCTION_NAME(args)}})
	const functionRegex = /\{\{([A-Z_][A-Z0-9_]*)\(([^}]*)\)\}\}/g;
	rendered = rendered.replace(functionRegex, (match, funcName, args) => {
		const func = allFunctions[funcName as keyof typeof allFunctions];
		if (func) {
			try {
				// Parse simple arguments (strings, numbers)
				const parsedArgs = args.split(',').map((arg: string) => {
					arg = arg.trim();
					if (arg.startsWith('"') && arg.endsWith('"')) {
						return arg.slice(1, -1); // Remove quotes
					}
					if (!isNaN(Number(arg))) {
						return Number(arg);
					}
					return arg;
				}).filter((arg: any) => arg !== '');
				
				return (func as any)(...parsedArgs);
			} catch (e) {
				console.warn(`Error executing function ${funcName}:`, e);
				return match;
			}
		}
		return match;
	});

	// Replace simple function calls ({{FUNCTION_NAME}})
	const simpleFunctionRegex = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;
	rendered = rendered.replace(simpleFunctionRegex, (match, funcName) => {
		const func = allFunctions[funcName as keyof typeof allFunctions];
		if (func) {
			try {
				return (func as any)();
			} catch (e) {
				console.warn(`Error executing function ${funcName}:`, e);
				return match;
			}
		}
		// Check if it's a variable instead
		return variables[funcName] !== undefined ? String(variables[funcName]) : match;
	});

	// Replace variables ({{variable_name}})
	const variableRegex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
	rendered = rendered.replace(variableRegex, (match, varName) => {
		if (variables[varName] !== undefined) {
			const value = variables[varName];
			if (typeof value === 'object') {
				return JSON.stringify(value);
			}
			return String(value);
		}
		return match; // Keep placeholder if variable not found
	});

	return rendered;
}

/**
 * Execute system prompt with variables
 */
export async function executeSystemPrompt(
	userId: string,
	promptId: string,
	request: ExecutePromptRequest
): Promise<ExecutePromptResult> {
	// Get the prompt
	const prompt = await getSystemPrompt(userId, promptId);
	if (!prompt) {
		throw new Error('System prompt not found');
	}

	// Prepare variables with defaults
	const finalVariables: Record<string, any> = {};
	
	// Apply defaults first
	for (const [name, config] of Object.entries(prompt.variables)) {
		if (config.default !== undefined) {
			finalVariables[name] = config.default;
		}
	}

	// Override with provided variables
	if (request.variables) {
		Object.assign(finalVariables, request.variables);
	}

	// Validate variables if requested
	let validationErrors: string[] | undefined;
	if (request.validate_variables !== false) {
		const validation = validatePromptVariables(finalVariables, prompt.variables);
		if (!validation.valid) {
			validationErrors = validation.errors;
			if (request.validate_variables === true) {
				// Strict validation - throw error
				throw new Error(`Variable validation failed: ${validation.errors.join(', ')}`);
			}
		}
	}

	// Render the template
	const renderedContent = renderTemplate(prompt.content, finalVariables);

	// Increment usage count
	await supabaseAdmin
		.from('system_prompts')
		.update({ 
			usage_count: prompt.usage_count + 1,
			updated_at: new Date().toISOString()
		})
		.eq('id', promptId);

	return {
		rendered_content: renderedContent,
		variables_used: finalVariables,
		validation_errors: validationErrors
	};
}

/**
 * Get popular/trending prompts
 */
export async function getTrendingPrompts(limit: number = 10): Promise<SystemPrompt[]> {
	const { data, error } = await supabaseAdmin
		.from('system_prompts')
		.select('*')
		.eq('is_public', true)
		.order('usage_count', { ascending: false })
		.limit(limit);

	if (error) {
		throw new Error(`Failed to get trending prompts: ${error.message}`);
	}

	return data || [];
}

/**
 * Get prompt categories
 */
export async function getPromptCategories(userId?: string): Promise<Array<{ category: string; count: number }>> {
	let query = supabaseAdmin
		.from('system_prompts')
		.select('category');

	if (userId) {
		query = query.or(`user_id.eq.${userId},is_public.eq.true`);
	} else {
		query = query.eq('is_public', true);
	}

	const { data, error } = await query;

	if (error) {
		throw new Error(`Failed to get prompt categories: ${error.message}`);
	}

	// Count categories
	const categoryMap = new Map<string, number>();
	for (const item of data || []) {
		const category = item.category || 'general';
		categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
	}

	return Array.from(categoryMap.entries()).map(([category, count]) => ({
		category,
		count
	})).sort((a, b) => b.count - a.count);
}

/**
 * Duplicate/fork a prompt
 */
export async function forkSystemPrompt(
	userId: string,
	promptId: string,
	newName?: string
): Promise<SystemPrompt> {
	// Get the original prompt
	const original = await getSystemPrompt(userId, promptId, true);
	if (!original) {
		throw new Error('System prompt not found');
	}

	// Create new prompt based on original
	const forkData = {
		user_id: userId,
		name: newName || `${original.name} (Copy)`,
		description: `Forked from: ${original.name}`,
		content: original.content,
		variables: original.variables,
		category: original.category,
		is_public: false, // Forks are private by default
		usage_count: 0
	};

	const { data, error } = await supabaseAdmin
		.from('system_prompts')
		.insert([forkData])
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to fork system prompt: ${error.message}`);
	}

	return data;
}

/**
 * Get version history for a system prompt
 */
export async function getPromptVersions(
	userId: string,
	promptId: string
): Promise<SystemPromptVersion[]> {
	// Verify user has access to this prompt
	const prompt = await getSystemPrompt(userId, promptId, false);
	if (!prompt) {
		throw new Error('System prompt not found');
	}

	const { data, error } = await supabaseAdmin
		.from('system_prompt_versions')
		.select('*')
		.eq('prompt_id', promptId)
		.order('version', { ascending: false });

	if (error) {
		throw new Error(`Failed to get prompt versions: ${error.message}`);
	}

	return data || [];
}

/**
 * Restore a system prompt to a previous version
 */
export async function restorePromptVersion(
	userId: string,
	promptId: string,
	version: number,
	changeSummary?: string
): Promise<SystemPrompt> {
	// Get the version to restore
	const { data: versionData, error: versionError } = await supabaseAdmin
		.from('system_prompt_versions')
		.select('*')
		.eq('prompt_id', promptId)
		.eq('version', version)
		.single();

	if (versionError || !versionData) {
		throw new Error('Version not found');
	}

	// Verify user has access to this prompt
	const currentPrompt = await getSystemPrompt(userId, promptId, false);
	if (!currentPrompt) {
		throw new Error('System prompt not found');
	}

	// Create a new version with the restored content
	return updateSystemPrompt(
		userId,
		promptId,
		{
			name: versionData.name,
			description: versionData.description,
			content: versionData.content,
			variables: versionData.variables,
			category: versionData.category,
			is_public: versionData.is_public
		},
		changeSummary || `Restored to version ${version}`
	);
}

/**
 * Get version comparison data
 */
export async function comparePromptVersions(
	userId: string,
	promptId: string,
	version1: number,
	version2: number
): Promise<{
	version1: SystemPromptVersion | SystemPrompt;
	version2: SystemPromptVersion | SystemPrompt;
}> {
	// Verify user has access to this prompt
	const prompt = await getSystemPrompt(userId, promptId, false);
	if (!prompt) {
		throw new Error('System prompt not found');
	}

	// Get the versions
	const [v1Data, v2Data] = await Promise.all([
		version1 === prompt.version 
			? Promise.resolve(prompt)
			: supabaseAdmin
				.from('system_prompt_versions')
				.select('*')
				.eq('prompt_id', promptId)
				.eq('version', version1)
				.single()
				.then(({ data, error }) => {
					if (error) throw new Error(`Version ${version1} not found`);
					return data;
				}),
		version2 === prompt.version
			? Promise.resolve(prompt)
			: supabaseAdmin
				.from('system_prompt_versions')
				.select('*')
				.eq('prompt_id', promptId)
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