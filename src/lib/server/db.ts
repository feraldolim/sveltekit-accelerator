import { supabase, supabaseAdmin, type Database } from './supabase.js';

export type Tables = Database['public']['Tables'];
export type Profile = Tables['profiles']['Row'];

/**
 * Generic database query builder with type safety
 */
export class QueryBuilder<T extends keyof Tables> {
	constructor(
		private table: T,
		private client = supabase
	) {}

	/**
	 * Select records from table
	 */
	async select<K extends keyof Tables[T]['Row']>(
		columns: K[] | '*' = '*',
		filters?: Partial<Tables[T]['Row']>
	): Promise<Pick<Tables[T]['Row'], K>[]> {
		let query = this.client.from(this.table).select(
			Array.isArray(columns) ? columns.join(',') : columns
		);

		if (filters) {
			Object.entries(filters).forEach(([key, value]) => {
				if (value !== undefined) {
					query = query.eq(key, value);
				}
			});
		}

		const { data, error } = await query;
		
		if (error) {
			throw new Error(`Database query failed: ${error.message}`);
		}

		return (data || []) as unknown as Pick<Tables[T]['Row'], K>[];
	}

	/**
	 * Insert new record
	 */
	async insert(
		data: Tables[T]['Insert']
	): Promise<Tables[T]['Row']> {
		const { data: result, error } = await this.client
			.from(this.table)
			.insert(data)
			.select()
			.single();

		if (error) {
			throw new Error(`Database insert failed: ${error.message}`);
		}

		return result;
	}

	/**
	 * Update existing record
	 */
	async update(
		id: string,
		data: Tables[T]['Update']
	): Promise<Tables[T]['Row']> {
		const { data: result, error } = await this.client
			.from(this.table)
			.update(data)
			.eq('id', id)
			.select()
			.single();

		if (error) {
			throw new Error(`Database update failed: ${error.message}`);
		}

		return result;
	}

	/**
	 * Delete record
	 */
	async delete(id: string): Promise<void> {
		const { error } = await this.client
			.from(this.table)
			.delete()
			.eq('id', id);

		if (error) {
			throw new Error(`Database delete failed: ${error.message}`);
		}
	}

	/**
	 * Count records
	 */
	async count(filters?: Partial<Tables[T]['Row']>): Promise<number> {
		let query = this.client
			.from(this.table)
			.select('id', { count: 'exact', head: true });

		if (filters) {
			Object.entries(filters).forEach(([key, value]) => {
				if (value !== undefined) {
					query = query.eq(key, value);
				}
			});
		}

		const { count, error } = await query;

		if (error) {
			throw new Error(`Database count failed: ${error.message}`);
		}

		return count || 0;
	}

	/**
	 * Check if record exists
	 */
	async exists(filters: Partial<Tables[T]['Row']>): Promise<boolean> {
		const count = await this.count(filters);
		return count > 0;
	}
}

/**
 * Create a query builder for a specific table
 */
export function createQueryBuilder<T extends keyof Tables>(
	table: T,
	useAdmin = false
) {
	return new QueryBuilder(table, useAdmin ? supabaseAdmin : supabase);
}

/**
 * User profile operations
 */
export const profiles = {
	/**
	 * Get user profile by ID
	 */
	async getById(id: string): Promise<Profile | null> {
		const { data, error } = await supabase
			.from('profiles')
			.select('*')
			.eq('id', id)
			.single();

		if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
			throw new Error(`Failed to get profile: ${error.message}`);
		}

		return data;
	},

	/**
	 * Get user profile by username
	 */
	async getByUsername(username: string): Promise<Profile | null> {
		const { data, error } = await supabase
			.from('profiles')
			.select('*')
			.eq('username', username)
			.single();

		if (error && error.code !== 'PGRST116') {
			throw new Error(`Failed to get profile: ${error.message}`);
		}

		return data;
	},

	/**
	 * Create user profile
	 */
	async create(profile: Tables['profiles']['Insert']): Promise<Profile> {
		const { data, error } = await supabaseAdmin
			.from('profiles')
			.insert(profile)
			.select()
			.single();

		if (error) {
			throw new Error(`Failed to create profile: ${error.message}`);
		}

		return data;
	},

	/**
	 * Update user profile
	 */
	async update(
		id: string,
		updates: Tables['profiles']['Update']
	): Promise<Profile> {
		const { data, error } = await supabase
			.from('profiles')
			.update({
				...updates,
				updated_at: new Date().toISOString()
			})
			.eq('id', id)
			.select()
			.single();

		if (error) {
			throw new Error(`Failed to update profile: ${error.message}`);
		}

		return data;
	},

	/**
	 * Search profiles by name or username
	 */
	async search(query: string, limit = 10): Promise<Profile[]> {
		const { data, error } = await supabase
			.from('profiles')
			.select('*')
			.or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
			.limit(limit);

		if (error) {
			throw new Error(`Failed to search profiles: ${error.message}`);
		}

		return data;
	},

	/**
	 * Check if username is available
	 */
	async isUsernameAvailable(username: string, excludeId?: string): Promise<boolean> {
		let query = supabase
			.from('profiles')
			.select('id')
			.eq('username', username);

		if (excludeId) {
			query = query.neq('id', excludeId);
		}

		const { data, error } = await query;

		if (error) {
			throw new Error(`Failed to check username availability: ${error.message}`);
		}

		return data.length === 0;
	}
};

/**
 * Generic pagination helper
 */
export interface PaginationOptions {
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
	data: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
		hasNext: boolean;
		hasPrev: boolean;
	};
}

/**
 * Get paginated results from a table
 */
export async function getPaginated<T extends keyof Tables>(
	table: T,
	options: PaginationOptions & {
		filters?: Partial<Tables[T]['Row']>;
		select?: string;
	} = {}
): Promise<PaginatedResult<Tables[T]['Row']>> {
	const {
		page = 1,
		limit = 10,
		sortBy = 'created_at',
		sortOrder = 'desc',
		filters,
		select = '*'
	} = options;

	const offset = (page - 1) * limit;

	// Get total count
	let countQuery = supabase
		.from(table)
		.select('id', { count: 'exact', head: true });

	if (filters) {
		Object.entries(filters).forEach(([key, value]) => {
			if (value !== undefined) {
				countQuery = countQuery.eq(key, value);
			}
		});
	}

	const { count, error: countError } = await countQuery;

	if (countError) {
		throw new Error(`Failed to count records: ${countError.message}`);
	}

	// Get data
	let dataQuery = supabase
		.from(table)
		.select(select)
		.order(sortBy, { ascending: sortOrder === 'asc' })
		.range(offset, offset + limit - 1);

	if (filters) {
		Object.entries(filters).forEach(([key, value]) => {
			if (value !== undefined) {
				dataQuery = dataQuery.eq(key, value);
			}
		});
	}

	const { data, error: dataError } = await dataQuery;

	if (dataError) {
		throw new Error(`Failed to fetch data: ${dataError.message}`);
	}

	const total = count || 0;
	const totalPages = Math.ceil(total / limit);

	return {
		data: (data || []) as unknown as Tables[T]['Row'][],
		pagination: {
			page,
			limit,
			total,
			totalPages,
			hasNext: page < totalPages,
			hasPrev: page > 1
		}
	};
}

/**
 * Batch operations helper
 */
export const batch = {
	/**
	 * Insert multiple records
	 */
	async insert<T extends keyof Tables>(
		table: T,
		records: Tables[T]['Insert'][]
	): Promise<Tables[T]['Row'][]> {
		const { data, error } = await supabaseAdmin
			.from(table)
			.insert(records)
			.select();

		if (error) {
			throw new Error(`Batch insert failed: ${error.message}`);
		}

		return data;
	},

	/**
	 * Update multiple records
	 */
	async update<T extends keyof Tables>(
		table: T,
		updates: { id: string; data: Tables[T]['Update'] }[]
	): Promise<void> {
		const promises = updates.map(({ id, data }) =>
			supabaseAdmin
				.from(table)
				.update(data)
				.eq('id', id)
		);

		const results = await Promise.all(promises);
		
		for (const result of results) {
			if (result.error) {
				throw new Error(`Batch update failed: ${result.error.message}`);
			}
		}
	},

	/**
	 * Delete multiple records
	 */
	async delete<T extends keyof Tables>(
		table: T,
		ids: string[]
	): Promise<void> {
		const { error } = await supabaseAdmin
			.from(table)
			.delete()
			.in('id', ids);

		if (error) {
			throw new Error(`Batch delete failed: ${error.message}`);
		}
	}
};

/**
 * Transaction helper (using Supabase RPC)
 */
export async function transaction<T>(
	operations: () => Promise<T>
): Promise<T> {
	// Note: Supabase doesn't have built-in transactions for client libraries
	// This is a placeholder for when you need to implement custom transaction logic
	// You might need to use Postgres functions or handle rollbacks manually
	
	return await operations();
} 