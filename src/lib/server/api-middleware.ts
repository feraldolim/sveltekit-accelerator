import type { RequestEvent } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { authenticateApiKey, checkRateLimit, recordApiUsage } from './api-keys.js';

export interface ApiAuthResult {
	user_id: string;
	api_key_id: string;
	scopes: string[];
	rate_limit: number;
}

/**
 * API Authentication middleware
 */
export async function authenticateApiRequest(event: RequestEvent): Promise<ApiAuthResult> {
	const authHeader = event.request.headers.get('authorization');
	
	if (!authHeader) {
		error(401, {
			message: 'Missing Authorization header',
			code: 'MISSING_AUTH'
		});
	}

	// Support both "Bearer" and "API-Key" prefixes
	const token = authHeader.replace(/^(Bearer|API-Key)\s+/i, '');
	
	if (!token) {
		error(401, {
			message: 'Invalid Authorization header format',
			code: 'INVALID_AUTH_FORMAT'
		});
	}

	// Authenticate the API key
	const authResult = await authenticateApiKey(token);
	
	if (!authResult.success) {
		error(401, {
			message: authResult.error || 'Invalid API key',
			code: 'INVALID_API_KEY'
		});
	}

	return {
		user_id: authResult.user_id!,
		api_key_id: authResult.api_key_id!,
		scopes: authResult.scopes!,
		rate_limit: authResult.rate_limit!
	};
}

/**
 * Check if user has required scope
 */
export function requireScope(scopes: string[], requiredScope: string): void {
	if (!scopes.includes(requiredScope) && !scopes.includes('*')) {
		error(403, {
			message: `Insufficient permissions. Required scope: ${requiredScope}`,
			code: 'INSUFFICIENT_SCOPE'
		});
	}
}

/**
 * Rate limiting middleware
 */
export async function checkApiRateLimit(apiKeyId: string, rateLimit: number): Promise<void> {
	const rateLimitCheck = await checkRateLimit(apiKeyId);
	
	if (!rateLimitCheck.allowed) {
		error(429, {
			message: 'Rate limit exceeded',
			code: 'RATE_LIMIT_EXCEEDED',
			details: {
				current_usage: rateLimitCheck.current_usage,
				limit: rateLimitCheck.limit,
				reset_time: rateLimitCheck.reset_time
			}
		});
	}
}

/**
 * Comprehensive API request handler
 */
export function createApiHandler<T = any>(
	handler: (event: RequestEvent, auth: ApiAuthResult) => Promise<T>,
	options: {
		required_scope?: string;
		rate_limit_check?: boolean;
		track_usage?: boolean;
		method?: string;
	} = {}
) {
	return async (event: RequestEvent) => {
		const startTime = Date.now();
		let auth: ApiAuthResult | null = null;
		let statusCode = 200;
		let errorMessage: string | undefined;

		try {
			// Authenticate request
			auth = await authenticateApiRequest(event);

			// Check required scope
			if (options.required_scope) {
				requireScope(auth.scopes, options.required_scope);
			}

			// Check rate limit
			if (options.rate_limit_check !== false) {
				await checkApiRateLimit(auth.api_key_id, auth.rate_limit);
			}

			// Call the actual handler
			const result = await handler(event, auth);

			// Track successful usage
			if (options.track_usage !== false && auth) {
				await recordApiUsage({
					api_key_id: auth.api_key_id,
					user_id: auth.user_id,
					endpoint: event.url.pathname,
					method: options.method || event.request.method,
					response_time: Date.now() - startTime,
					status_code: statusCode
				});
			}

			// Return JSON response
			return json(result);

		} catch (err: any) {
			statusCode = err.status || 500;
			errorMessage = err.body?.message || err.message || 'Internal server error';

			// Track failed usage
			if (options.track_usage !== false && auth) {
				await recordApiUsage({
					api_key_id: auth.api_key_id,
					user_id: auth.user_id,
					endpoint: event.url.pathname,
					method: options.method || event.request.method,
					response_time: Date.now() - startTime,
					status_code: statusCode,
					error_message: errorMessage
				});
			}

			// Re-throw the error
			throw err;
		}
	};
}

/**
 * Validate request body against schema
 */
export function validateRequestBody(body: any, requiredFields: string[]): void {
	if (!body || typeof body !== 'object') {
		error(400, {
			message: 'Request body must be a valid JSON object',
			code: 'INVALID_BODY'
		});
	}

	const missingFields = requiredFields.filter(field => !(field in body));
	if (missingFields.length > 0) {
		error(400, {
			message: `Missing required fields: ${missingFields.join(', ')}`,
			code: 'MISSING_FIELDS',
			details: { missing_fields: missingFields }
		});
	}
}

/**
 * Validate query parameters
 */
export function validateQueryParams(url: URL, allowedParams: string[]): void {
	const invalidParams = Array.from(url.searchParams.keys()).filter(
		param => !allowedParams.includes(param)
	);

	if (invalidParams.length > 0) {
		error(400, {
			message: `Invalid query parameters: ${invalidParams.join(', ')}`,
			code: 'INVALID_PARAMS',
			details: { 
				invalid_params: invalidParams,
				allowed_params: allowedParams
			}
		});
	}
}

/**
 * Parse pagination parameters
 */
export function parsePagination(url: URL): { limit: number; offset: number } {
	const limitParam = url.searchParams.get('limit');
	const offsetParam = url.searchParams.get('offset');
	const pageParam = url.searchParams.get('page');

	let limit = 10; // Default limit
	let offset = 0; // Default offset

	if (limitParam) {
		const parsedLimit = parseInt(limitParam, 10);
		if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
			error(400, {
				message: 'Limit must be a number between 1 and 100',
				code: 'INVALID_LIMIT'
			});
		}
		limit = parsedLimit;
	}

	if (offsetParam) {
		const parsedOffset = parseInt(offsetParam, 10);
		if (isNaN(parsedOffset) || parsedOffset < 0) {
			error(400, {
				message: 'Offset must be a non-negative number',
				code: 'INVALID_OFFSET'
			});
		}
		offset = parsedOffset;
	} else if (pageParam) {
		// Support page-based pagination (page=1 means offset=0)
		const parsedPage = parseInt(pageParam, 10);
		if (isNaN(parsedPage) || parsedPage < 1) {
			error(400, {
				message: 'Page must be a positive number starting from 1',
				code: 'INVALID_PAGE'
			});
		}
		offset = (parsedPage - 1) * limit;
	}

	return { limit, offset };
}

/**
 * Create standardized API response
 */
export function createApiResponse<T>(
	data: T,
	metadata?: {
		total?: number;
		limit?: number;
		offset?: number;
		has_more?: boolean;
	}
) {
	const response: any = { data };

	if (metadata) {
		response.metadata = metadata;
		
		// Add pagination info if available
		if (metadata.total !== undefined && metadata.limit && metadata.offset !== undefined) {
			response.pagination = {
				total: metadata.total,
				limit: metadata.limit,
				offset: metadata.offset,
				page: Math.floor(metadata.offset / metadata.limit) + 1,
				total_pages: Math.ceil(metadata.total / metadata.limit),
				has_more: metadata.has_more ?? (metadata.offset + metadata.limit < metadata.total)
			};
		}
	}

	return response;
}

/**
 * Error response formatter
 */
export function formatApiError(
	message: string,
	code: string,
	status: number = 400,
	details?: any
) {
	const errorResponse: any = {
		error: {
			message,
			code,
			type: status >= 500 ? 'server_error' : 'client_error'
		}
	};

	if (details) {
		errorResponse.error.details = details;
	}

	return json(errorResponse, { status });
}

/**
 * Handle async errors in API routes
 */
export function handleApiError(err: any) {
	console.error('API Error:', err);

	// Handle SvelteKit errors
	if (err.status) {
		throw err;
	}

	// Handle validation errors
	if (err.name === 'ValidationError') {
		error(400, {
			message: err.message,
			code: 'VALIDATION_ERROR',
			details: err.details
		});
	}

	// Handle database errors
	if (err.code === 'PGRST116') {
		error(404, {
			message: 'Resource not found',
			code: 'NOT_FOUND'
		});
	}

	// Generic server error
	error(500, {
		message: 'Internal server error',
		code: 'INTERNAL_ERROR'
	});
}