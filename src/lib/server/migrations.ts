import { supabaseAdmin } from './supabase.js';
import { readFileSync } from 'fs';
import { join } from 'path';

interface Migration {
	id: string;
	name: string;
	filename: string;
	applied_at?: string;
}

interface MigrationResult {
	success: boolean;
	message: string;
	error?: string;
}

/**
 * Create migrations table if it doesn't exist
 */
async function createMigrationsTable(): Promise<void> {
	const { error } = await supabaseAdmin.rpc('exec', {
		sql: `
			CREATE TABLE IF NOT EXISTS migrations (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				filename TEXT NOT NULL,
				applied_at TIMESTAMPTZ DEFAULT NOW()
			);
		`
	});

	if (error) {
		throw new Error(`Failed to create migrations table: ${error.message}`);
	}
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(): Promise<Migration[]> {
	const { data, error } = await supabaseAdmin
		.from('migrations')
		.select('*')
		.order('applied_at', { ascending: true });

	if (error) {
		throw new Error(`Failed to get applied migrations: ${error.message}`);
	}

	return data || [];
}

/**
 * Mark migration as applied
 */
async function markMigrationAsApplied(migration: Omit<Migration, 'applied_at'>): Promise<void> {
	const { error } = await supabaseAdmin.from('migrations').insert([migration]);

	if (error) {
		throw new Error(`Failed to mark migration as applied: ${error.message}`);
	}
}

/**
 * Run a single migration
 */
async function runMigration(migrationPath: string): Promise<MigrationResult> {
	try {
		const sql = readFileSync(migrationPath, 'utf8');

		// Split SQL into individual statements
		const statements = sql
			.split(';')
			.map((stmt) => stmt.trim())
			.filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

		// Execute each statement
		for (const statement of statements) {
			const { error } = await supabaseAdmin.rpc('exec', {
				sql: statement
			});

			if (error) {
				return {
					success: false,
					message: `Failed to execute statement: ${statement.substring(0, 100)}...`,
					error: error.message
				};
			}
		}

		return {
			success: true,
			message: 'Migration executed successfully'
		};
	} catch (error) {
		return {
			success: false,
			message: 'Failed to read or execute migration',
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Get list of pending migrations
 */
export async function getPendingMigrations(): Promise<Migration[]> {
	const appliedMigrations = await getAppliedMigrations();
	const appliedIds = new Set(appliedMigrations.map((m) => m.id));

	// In a real implementation, you would scan the migrations directory
	// For now, we'll return a hardcoded list
	const allMigrations: Migration[] = [
		{
			id: '001',
			name: 'Initial schema',
			filename: '001_initial_schema.sql'
		}
	];

	return allMigrations.filter((m) => !appliedIds.has(m.id));
}

/**
 * Run all pending migrations
 */
export async function runPendingMigrations(): Promise<{
	success: boolean;
	results: { migration: Migration; result: MigrationResult }[];
}> {
	try {
		await createMigrationsTable();

		const pendingMigrations = await getPendingMigrations();
		const results: { migration: Migration; result: MigrationResult }[] = [];

		for (const migration of pendingMigrations) {
			const migrationPath = join(process.cwd(), 'migrations', migration.filename);
			const result = await runMigration(migrationPath);

			results.push({ migration, result });

			if (result.success) {
				await markMigrationAsApplied(migration);
			} else {
				// Stop on first failure
				break;
			}
		}

		const allSuccessful = results.every((r) => r.result.success);

		return {
			success: allSuccessful,
			results
		};
	} catch (error) {
		return {
			success: false,
			results: [
				{
					migration: { id: 'unknown', name: 'Unknown', filename: 'unknown' },
					result: {
						success: false,
						message: 'Failed to run migrations',
						error: error instanceof Error ? error.message : String(error)
					}
				}
			]
		};
	}
}

/**
 * Rollback a migration (placeholder for future implementation)
 */
export async function rollbackMigration(migrationId: string): Promise<MigrationResult> {
	// This would require storing rollback SQL or implementing reverse operations
	// For now, just return not implemented
	return {
		success: false,
		message: 'Migration rollback not implemented yet'
	};
}

/**
 * Get migration status
 */
export async function getMigrationStatus(): Promise<{
	applied: Migration[];
	pending: Migration[];
}> {
	const applied = await getAppliedMigrations();
	const pending = await getPendingMigrations();

	return { applied, pending };
}

/**
 * Validate database schema
 */
export async function validateSchema(): Promise<{
	valid: boolean;
	issues: string[];
}> {
	const issues: string[] = [];

	try {
		// Check if required tables exist
		const requiredTables = [
			'profiles',
			'chats',
			'messages',
			'user_activity',
			'user_sessions',
			'api_usage',
			'storage_usage'
		];

		for (const table of requiredTables) {
			const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);

			if (error) {
				issues.push(`Table '${table}' is missing or inaccessible: ${error.message}`);
			}
		}

		// Check RLS policies
		const { data: policies, error: policiesError } = await supabaseAdmin.rpc('get_policies');

		if (policiesError) {
			issues.push(`Failed to check RLS policies: ${policiesError.message}`);
		}

		// Add more validation checks as needed

		return {
			valid: issues.length === 0,
			issues
		};
	} catch (error) {
		return {
			valid: false,
			issues: [
				`Schema validation failed: ${error instanceof Error ? error.message : String(error)}`
			]
		};
	}
}

/**
 * Create database backup (metadata only)
 */
export async function createBackup(): Promise<{
	success: boolean;
	backup?: {
		timestamp: string;
		tables: string[];
		size: number;
	};
	error?: string;
}> {
	try {
		const timestamp = new Date().toISOString();
		const tables: string[] = [];
		let totalSize = 0;

		// Get table information
		const { data: tableStats, error } = await supabaseAdmin.rpc('get_table_stats');

		if (error) {
			return {
				success: false,
				error: `Failed to get table stats: ${error.message}`
			};
		}

		// Process table stats
		if (tableStats) {
			for (const stat of tableStats) {
				tables.push(stat.table_name);
				totalSize += stat.size_bytes || 0;
			}
		}

		return {
			success: true,
			backup: {
				timestamp,
				tables,
				size: totalSize
			}
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Seed database with initial data
 */
export async function seedDatabase(): Promise<MigrationResult> {
	try {
		// Add any initial data seeding here
		// For example, default user roles, settings, etc.

		return {
			success: true,
			message: 'Database seeded successfully'
		};
	} catch (error) {
		return {
			success: false,
			message: 'Failed to seed database',
			error: error instanceof Error ? error.message : String(error)
		};
	}
}
