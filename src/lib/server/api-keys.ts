import { supabaseAdmin } from './supabase.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface ApiKey {
	id: string;
	user_id: string;
	name: string;
	key_prefix: string;
	key_hash: string;
	scopes: string[];
	rate_limit: number;
	usage_count: number;
	last_used_at?: string;
	expires_at?: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface CreateApiKeyRequest {
	name: string;
	scopes?: string[];
	rate_limit?: number;
	expires_at?: string;
}

export interface ApiKeyAuthResult {
	success: boolean;
	user_id?: string;
	api_key_id?: string;
	scopes?: string[];
	rate_limit?: number;
	error?: string;
}

/**
 * Generate a secure API key
 */
function generateApiKey(prefix: string = 'ska_live_'): { key: string; hash: string } {
	// Generate 32 random bytes and convert to hex
	const randomBytes = crypto.randomBytes(32);
	const keyPart = randomBytes.toString('hex');
	const fullKey = prefix + keyPart;
	
	// Hash the key for storage
	const hash = bcrypt.hashSync(fullKey, 12);
	
	return { key: fullKey, hash };
}

/**
 * Validate API key format
 */
export function validateApiKeyFormat(key: string): boolean {
	// Check if key starts with valid prefix and has correct length
	const validPrefixes = ['ska_live_', 'ska_test_'];
	const hasValidPrefix = validPrefixes.some(prefix => key.startsWith(prefix));
	
	if (!hasValidPrefix) return false;
	
	// Check total length (prefix + 64 hex characters)
	const expectedLength = key.startsWith('ska_live_') ? 73 : 73; // Both prefixes are 9 chars + 64 hex
	return key.length === expectedLength;
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(
	userId: string,
	request: CreateApiKeyRequest,
	isTest: boolean = false
): Promise<{ apiKey: ApiKey & { key: string } }> {
	const prefix = isTest ? 'ska_test_' : 'ska_live_';
	const { key, hash } = generateApiKey(prefix);
	
	const keyData = {
		user_id: userId,
		name: request.name,
		key_prefix: prefix,
		key_hash: hash,
		scopes: request.scopes || ['read', 'write'],
		rate_limit: request.rate_limit || 100,
		expires_at: request.expires_at || null
	};

	const { data, error } = await supabaseAdmin
		.from('api_keys')
		.insert([keyData])
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to create API key: ${error.message}`);
	}

	return {
		apiKey: { ...data, key }
	};
}

/**
 * List API keys for a user (without revealing the actual keys)
 */
export async function listApiKeys(userId: string): Promise<Omit<ApiKey, 'key_hash'>[]> {
	const { data, error } = await supabaseAdmin
		.from('api_keys')
		.select('id, user_id, name, key_prefix, scopes, rate_limit, usage_count, last_used_at, expires_at, is_active, created_at, updated_at')
		.eq('user_id', userId)
		.eq('is_active', true)
		.order('created_at', { ascending: false });

	if (error) {
		throw new Error(`Failed to list API keys: ${error.message}`);
	}

	return data || [];
}

/**
 * Get API key by ID
 */
export async function getApiKey(userId: string, keyId: string): Promise<Omit<ApiKey, 'key_hash'> | null> {
	const { data, error } = await supabaseAdmin
		.from('api_keys')
		.select('id, user_id, name, key_prefix, scopes, rate_limit, usage_count, last_used_at, expires_at, is_active, created_at, updated_at')
		.eq('id', keyId)
		.eq('user_id', userId)
		.single();

	if (error) {
		if (error.code === 'PGRST116') return null; // Not found
		throw new Error(`Failed to get API key: ${error.message}`);
	}

	return data;
}

/**
 * Update API key
 */
export async function updateApiKey(
	userId: string,
	keyId: string,
	updates: Partial<Pick<ApiKey, 'name' | 'scopes' | 'rate_limit' | 'expires_at' | 'is_active'>>
): Promise<Omit<ApiKey, 'key_hash'>> {
	const { data, error } = await supabaseAdmin
		.from('api_keys')
		.update({
			...updates,
			updated_at: new Date().toISOString()
		})
		.eq('id', keyId)
		.eq('user_id', userId)
		.select('id, user_id, name, key_prefix, scopes, rate_limit, usage_count, last_used_at, expires_at, is_active, created_at, updated_at')
		.single();

	if (error) {
		throw new Error(`Failed to update API key: ${error.message}`);
	}

	return data;
}

/**
 * Revoke (deactivate) an API key
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
	const { error } = await supabaseAdmin
		.from('api_keys')
		.update({
			is_active: false,
			updated_at: new Date().toISOString()
		})
		.eq('id', keyId)
		.eq('user_id', userId);

	if (error) {
		throw new Error(`Failed to revoke API key: ${error.message}`);
	}

	return true;
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(userId: string, keyId: string): Promise<boolean> {
	const { error } = await supabaseAdmin
		.from('api_keys')
		.delete()
		.eq('id', keyId)
		.eq('user_id', userId);

	if (error) {
		throw new Error(`Failed to delete API key: ${error.message}`);
	}

	return true;
}

/**
 * Authenticate an API key and return user information
 */
export async function authenticateApiKey(key: string): Promise<ApiKeyAuthResult> {
	if (!validateApiKeyFormat(key)) {
		return { success: false, error: 'Invalid API key format' };
	}

	// Get all active API keys to check against
	const { data: apiKeys, error } = await supabaseAdmin
		.from('api_keys')
		.select('id, user_id, key_hash, scopes, rate_limit, expires_at, is_active')
		.eq('is_active', true);

	if (error) {
		return { success: false, error: 'Database error' };
	}

	if (!apiKeys) {
		return { success: false, error: 'No API keys found' };
	}

	// Check each API key hash
	for (const apiKey of apiKeys) {
		if (bcrypt.compareSync(key, apiKey.key_hash)) {
			// Check expiration
			if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
				return { success: false, error: 'API key has expired' };
			}

			// Update last used timestamp and usage count
			await supabaseAdmin
				.from('api_keys')
				.update({
					last_used_at: new Date().toISOString(),
					usage_count: supabaseAdmin.rpc('increment_usage_count', { key_id: apiKey.id })
				})
				.eq('id', apiKey.id);

			return {
				success: true,
				user_id: apiKey.user_id,
				api_key_id: apiKey.id,
				scopes: apiKey.scopes,
				rate_limit: apiKey.rate_limit
			};
		}
	}

	return { success: false, error: 'Invalid API key' };
}

/**
 * Check rate limit for an API key
 */
export async function checkRateLimit(apiKeyId: string, windowHours: number = 1): Promise<{
	allowed: boolean;
	current_usage: number;
	limit: number;
	reset_time: Date;
}> {
	// Get API key rate limit
	const { data: apiKey, error: keyError } = await supabaseAdmin
		.from('api_keys')
		.select('rate_limit')
		.eq('id', apiKeyId)
		.single();

	if (keyError) {
		throw new Error('Failed to get API key rate limit');
	}

	const limit = apiKey.rate_limit;
	const windowStart = new Date();
	windowStart.setHours(windowStart.getHours() - windowHours);

	// Count API usage in the current window
	const { count, error: countError } = await supabaseAdmin
		.from('api_usage')
		.select('*', { count: 'exact', head: true })
		.eq('api_key_id', apiKeyId)
		.gte('created_at', windowStart.toISOString());

	if (countError) {
		throw new Error('Failed to check rate limit');
	}

	const currentUsage = count || 0;
	const resetTime = new Date();
	resetTime.setHours(resetTime.getHours() + 1);

	return {
		allowed: currentUsage < limit,
		current_usage: currentUsage,
		limit,
		reset_time: resetTime
	};
}

/**
 * Record API usage for analytics and rate limiting
 */
export async function recordApiUsage(data: {
	api_key_id: string;
	user_id: string;
	endpoint: string;
	method: string;
	model?: string;
	tokens_used?: number;
	response_time?: number;
	status_code: number;
	error_message?: string;
}): Promise<void> {
	const { error } = await supabaseAdmin
		.from('api_usage')
		.insert([{
			...data,
			created_at: new Date().toISOString()
		}]);

	if (error) {
		console.error('Failed to record API usage:', error);
		// Don't throw error as this shouldn't break the API call
	}
}

/**
 * Get API usage statistics for a user
 */
export async function getApiUsageStats(userId: string, days: number = 30): Promise<{
	total_requests: number;
	total_tokens: number;
	requests_by_key: Record<string, number>;
	requests_by_model: Record<string, number>;
	daily_usage: Array<{ date: string; requests: number; tokens: number }>;
}> {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);

	// Get API keys for this user
	const { data: apiKeys } = await supabaseAdmin
		.from('api_keys')
		.select('id, name')
		.eq('user_id', userId);

	const apiKeyIds = apiKeys?.map(k => k.id) || [];

	if (apiKeyIds.length === 0) {
		return {
			total_requests: 0,
			total_tokens: 0,
			requests_by_key: {},
			requests_by_model: {},
			daily_usage: []
		};
	}

	// Get usage data
	const { data: usage, error } = await supabaseAdmin
		.from('api_usage')
		.select('*')
		.in('api_key_id', apiKeyIds)
		.gte('created_at', startDate.toISOString());

	if (error) {
		throw new Error(`Failed to get API usage stats: ${error.message}`);
	}

	if (!usage) {
		return {
			total_requests: 0,
			total_tokens: 0,
			requests_by_key: {},
			requests_by_model: {},
			daily_usage: []
		};
	}

	// Calculate statistics
	const totalRequests = usage.length;
	const totalTokens = usage.reduce((sum, u) => sum + (u.tokens_used || 0), 0);

	const requestsByKey: Record<string, number> = {};
	const requestsByModel: Record<string, number> = {};
	const dailyUsage: Record<string, { requests: number; tokens: number }> = {};

	for (const u of usage) {
		// Count by API key
		const keyName = apiKeys?.find(k => k.id === u.api_key_id)?.name || u.api_key_id;
		requestsByKey[keyName] = (requestsByKey[keyName] || 0) + 1;

		// Count by model
		if (u.model) {
			requestsByModel[u.model] = (requestsByModel[u.model] || 0) + 1;
		}

		// Count by day
		const date = new Date(u.created_at).toISOString().split('T')[0];
		if (!dailyUsage[date]) {
			dailyUsage[date] = { requests: 0, tokens: 0 };
		}
		dailyUsage[date].requests += 1;
		dailyUsage[date].tokens += u.tokens_used || 0;
	}

	return {
		total_requests: totalRequests,
		total_tokens: totalTokens,
		requests_by_key: requestsByKey,
		requests_by_model: requestsByModel,
		daily_usage: Object.entries(dailyUsage).map(([date, stats]) => ({
			date,
			...stats
		})).sort((a, b) => a.date.localeCompare(b.date))
	};
}