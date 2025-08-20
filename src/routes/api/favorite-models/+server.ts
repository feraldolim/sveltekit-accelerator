import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	addFavoriteModel,
	removeFavoriteModel,
	getUserFavoriteModels,
	setDefaultModel
} from '$lib/server/favorite-models.js';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.session || !locals.user) {
		error(401, 'Authentication required');
	}

	try {
		const favoriteModels = await getUserFavoriteModels(locals.user.id);
		return json({ favoriteModels });
	} catch (err) {
		console.error('Failed to fetch favorite models:', err);
		error(500, 'Failed to fetch favorite models');
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session || !locals.user) {
		error(401, 'Authentication required');
	}

	try {
		const { modelId, displayName, isDefault } = await request.json();

		if (!modelId) {
			error(400, 'Model ID is required');
		}

		const favoriteModel = await addFavoriteModel(
			locals.user.id,
			modelId,
			displayName,
			isDefault
		);

		return json({ favoriteModel });
	} catch (err) {
		console.error('Failed to add favorite model:', err);
		error(500, 'Failed to add favorite model');
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.session || !locals.user) {
		error(401, 'Authentication required');
	}

	try {
		const { modelId } = await request.json();

		if (!modelId) {
			error(400, 'Model ID is required');
		}

		await removeFavoriteModel(locals.user.id, modelId);
		return json({ success: true });
	} catch (err) {
		console.error('Failed to remove favorite model:', err);
		error(500, 'Failed to remove favorite model');
	}
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!locals.session || !locals.user) {
		error(401, 'Authentication required');
	}

	try {
		const { modelId, action } = await request.json();

		if (!modelId || !action) {
			error(400, 'Model ID and action are required');
		}

		if (action === 'set_default') {
			const defaultModel = await setDefaultModel(locals.user.id, modelId);
			return json({ defaultModel });
		}

		error(400, 'Invalid action');
	} catch (err) {
		console.error('Failed to update favorite model:', err);
		error(500, 'Failed to update favorite model');
	}
};