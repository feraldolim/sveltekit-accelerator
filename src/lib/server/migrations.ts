import { supabaseAdmin } from './supabase.js';

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
 * Run a single migration from SQL content
 */
async function runMigration(sql: string): Promise<MigrationResult> {
	try {
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
			message: 'Failed to execute migration',
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Migration definitions with embedded SQL
 * In Cloudflare Edge runtime, we can't read files from filesystem
 */
const MIGRATION_DEFINITIONS: { [key: string]: { migration: Migration; sql: string } } = {
	'001': {
		migration: {
			id: '001',
			name: 'Initial schema',
			filename: '001_initial_schema.sql'
		},
		sql: `
			-- Create profiles table
			CREATE TABLE IF NOT EXISTS profiles (
				id UUID REFERENCES auth.users(id) PRIMARY KEY,
				username TEXT UNIQUE,
				full_name TEXT,
				avatar_url TEXT,
				bio TEXT,
				created_at TIMESTAMPTZ DEFAULT NOW(),
				updated_at TIMESTAMPTZ DEFAULT NOW()
			);

			-- Create chats table
			CREATE TABLE IF NOT EXISTS chats (
				id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
				user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
				title TEXT NOT NULL,
				created_at TIMESTAMPTZ DEFAULT NOW(),
				updated_at TIMESTAMPTZ DEFAULT NOW()
			);

			-- Create messages table
			CREATE TABLE IF NOT EXISTS messages (
				id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
				chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
				role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
				content TEXT NOT NULL,
				created_at TIMESTAMPTZ DEFAULT NOW()
			);

			-- Create user_activity table
			CREATE TABLE IF NOT EXISTS user_activity (
				id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
				user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
				action TEXT NOT NULL,
				details JSONB,
				ip_address INET,
				user_agent TEXT,
				created_at TIMESTAMPTZ DEFAULT NOW()
			);

			-- Create api_usage table
			CREATE TABLE IF NOT EXISTS api_usage (
				id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
				user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
				endpoint TEXT NOT NULL,
				method TEXT NOT NULL,
				model TEXT,
				tokens_used INTEGER,
				response_time INTEGER,
				status_code INTEGER,
				error_message TEXT,
				created_at TIMESTAMPTZ DEFAULT NOW()
			);

			-- Create storage_usage table
			CREATE TABLE IF NOT EXISTS storage_usage (
				id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
				user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
				bucket TEXT NOT NULL,
				file_path TEXT NOT NULL,
				file_size BIGINT NOT NULL,
				mime_type TEXT,
				deleted_at TIMESTAMPTZ,
				created_at TIMESTAMPTZ DEFAULT NOW()
			);

			-- Enable RLS
			ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
			ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
			ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
			ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
			ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
			ALTER TABLE storage_usage ENABLE ROW LEVEL SECURITY;

			-- Create RLS policies
			CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
			CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
			CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

			CREATE POLICY "Users can view own chats" ON chats FOR SELECT USING (auth.uid() = user_id);
			CREATE POLICY "Users can create own chats" ON chats FOR INSERT WITH CHECK (auth.uid() = user_id);
			CREATE POLICY "Users can update own chats" ON chats FOR UPDATE USING (auth.uid() = user_id);
			CREATE POLICY "Users can delete own chats" ON chats FOR DELETE USING (auth.uid() = user_id);

			CREATE POLICY "Users can view own messages" ON messages FOR SELECT USING (
				auth.uid() IN (SELECT user_id FROM chats WHERE id = chat_id)
			);
			CREATE POLICY "Users can create messages in own chats" ON messages FOR INSERT WITH CHECK (
				auth.uid() IN (SELECT user_id FROM chats WHERE id = chat_id)
			);

			CREATE POLICY "Users can view own activity" ON user_activity FOR SELECT USING (auth.uid() = user_id);
			CREATE POLICY "Users can view own api usage" ON api_usage FOR SELECT USING (auth.uid() = user_id);
			CREATE POLICY "Users can view own storage usage" ON storage_usage FOR SELECT USING (auth.uid() = user_id);

			-- Create indexes
			CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
			CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
			CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
			CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
			CREATE INDEX IF NOT EXISTS idx_storage_usage_user_id ON storage_usage(user_id);
		`
	}
};

/**
 * Get list of pending migrations
 */
export async function getPendingMigrations(): Promise<Migration[]> {
	const appliedMigrations = await getAppliedMigrations();
	const appliedIds = new Set(appliedMigrations.map((m) => m.id));

	const allMigrations = Object.values(MIGRATION_DEFINITIONS).map(def => def.migration);
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
			const migrationDef = MIGRATION_DEFINITIONS[migration.id];
			if (!migrationDef) {
				results.push({
					migration,
					result: {
						success: false,
						message: `Migration definition not found for ${migration.id}`
					}
				});
				break;
			}

			const result = await runMigration(migrationDef.sql);
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function rollbackMigration(_migrationId: string): Promise<MigrationResult> {
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
			const { error } = await supabaseAdmin.from(table).select('*').limit(1);

			if (error) {
				issues.push(`Table '${table}' is missing or inaccessible: ${error.message}`);
			}
		}

		// Check RLS policies
		const { error: policiesError } = await supabaseAdmin.rpc('get_policies');

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
