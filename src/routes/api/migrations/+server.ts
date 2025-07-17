import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	runPendingMigrations,
	getMigrationStatus,
	validateSchema,
	createBackup,
	seedDatabase
} from '$lib/server/migrations.js';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		// Require authentication
		if (!locals.session || !locals.user) {
			error(401, 'Authentication required');
		}

		// For now, anyone can check migration status
		// In production, you might want to restrict this to admin users
		const action = url.searchParams.get('action');

		switch (action) {
			case 'status':
				const status = await getMigrationStatus();
				return json({
					success: true,
					data: status
				});

			case 'validate':
				const validation = await validateSchema();
				return json({
					success: true,
					data: validation
				});

			case 'backup':
				const backup = await createBackup();
				return json({
					success: backup.success,
					data: backup.backup,
					error: backup.error
				});

			default:
				const defaultStatus = await getMigrationStatus();
				return json({
					success: true,
					data: defaultStatus
				});
		}
	} catch (err) {
		console.error('Migrations API error:', err);
		error(500, 'Internal server error');
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Require authentication
		if (!locals.session || !locals.user) {
			error(401, 'Authentication required');
		}

		const { action } = await request.json();

		switch (action) {
			case 'run':
				const result = await runPendingMigrations();
				return json({
					success: result.success,
					data: result.results,
					message: result.success ? 'All migrations completed' : 'Some migrations failed'
				});

			case 'seed':
				const seedResult = await seedDatabase();
				return json({
					success: seedResult.success,
					message: seedResult.message,
					error: seedResult.error
				});

			default:
				error(400, 'Invalid action');
		}
	} catch (err) {
		console.error('Migrations API error:', err);
		error(500, 'Internal server error');
	}
};
