import { supabaseAdmin } from './supabase.js';
import type { Database } from './database.types.js';

export type FavoriteModel = Database['public']['Tables']['user_favorite_models']['Row'];
export type FavoriteModelInsert = Database['public']['Tables']['user_favorite_models']['Insert'];
export type FavoriteModelUpdate = Database['public']['Tables']['user_favorite_models']['Update'];

/**
 * Add a model to user's favorites
 */
export async function addFavoriteModel(
	userId: string,
	modelId: string,
	displayName?: string,
	isDefault: boolean = false
): Promise<FavoriteModel> {
	// If setting as default, unset any existing default
	if (isDefault) {
		await supabaseAdmin
			.from('user_favorite_models')
			.update({ is_default: false })
			.eq('user_id', userId)
			.eq('is_default', true);
	}

	const { data, error } = await supabaseAdmin
		.from('user_favorite_models')
		.upsert({
			user_id: userId,
			model_id: modelId,
			display_name: displayName,
			is_default: isDefault
		}, {
			onConflict: 'user_id,model_id'
		})
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to add favorite model: ${error.message}`);
	}

	return data;
}

/**
 * Remove a model from user's favorites
 */
export async function removeFavoriteModel(userId: string, modelId: string): Promise<void> {
	const { error } = await supabaseAdmin
		.from('user_favorite_models')
		.delete()
		.eq('user_id', userId)
		.eq('model_id', modelId);

	if (error) {
		throw new Error(`Failed to remove favorite model: ${error.message}`);
	}
}

/**
 * Get all favorite models for a user
 */
export async function getUserFavoriteModels(userId: string): Promise<FavoriteModel[]> {
	const { data, error } = await supabaseAdmin
		.from('user_favorite_models')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false });

	if (error) {
		throw new Error(`Failed to fetch favorite models: ${error.message}`);
	}

	return data || [];
}

/**
 * Check if a model is favorited by the user
 */
export async function isModelFavorited(userId: string, modelId: string): Promise<boolean> {
	const { data, error } = await supabaseAdmin
		.from('user_favorite_models')
		.select('id')
		.eq('user_id', userId)
		.eq('model_id', modelId)
		.single();

	if (error && error.code !== 'PGRST116') {
		throw new Error(`Failed to check favorite status: ${error.message}`);
	}

	return !!data;
}

/**
 * Get user's default model
 */
export async function getUserDefaultModel(userId: string): Promise<FavoriteModel | null> {
	const { data, error } = await supabaseAdmin
		.from('user_favorite_models')
		.select('*')
		.eq('user_id', userId)
		.eq('is_default', true)
		.single();

	if (error && error.code !== 'PGRST116') {
		throw new Error(`Failed to fetch default model: ${error.message}`);
	}

	return data || null;
}

/**
 * Set a model as the user's default
 */
export async function setDefaultModel(userId: string, modelId: string): Promise<FavoriteModel> {
	// First unset any existing default
	await supabaseAdmin
		.from('user_favorite_models')
		.update({ is_default: false })
		.eq('user_id', userId)
		.eq('is_default', true);

	// Set the new default (will upsert if not favorited yet)
	const { data, error } = await supabaseAdmin
		.from('user_favorite_models')
		.upsert({
			user_id: userId,
			model_id: modelId,
			is_default: true
		}, {
			onConflict: 'user_id,model_id'
		})
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to set default model: ${error.message}`);
	}

	return data;
}

/**
 * Update favorite model display name
 */
export async function updateFavoriteModel(
	userId: string,
	modelId: string,
	updates: FavoriteModelUpdate
): Promise<FavoriteModel> {
	const { data, error } = await supabaseAdmin
		.from('user_favorite_models')
		.update(updates)
		.eq('user_id', userId)
		.eq('model_id', modelId)
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to update favorite model: ${error.message}`);
	}

	return data;
}

/**
 * Get favorite model IDs as a simple array for quick lookups
 */
export async function getFavoriteModelIds(userId: string): Promise<string[]> {
	const { data, error } = await supabaseAdmin
		.from('user_favorite_models')
		.select('model_id')
		.eq('user_id', userId);

	if (error) {
		throw new Error(`Failed to fetch favorite model IDs: ${error.message}`);
	}

	return (data || []).map(row => row.model_id);
}

/**
 * Bulk toggle favorites (for migrating existing users or batch operations)
 */
export async function bulkToggleFavorites(
	userId: string,
	modelIds: string[],
	favorite: boolean
): Promise<void> {
	if (favorite) {
		// Add favorites
		const inserts = modelIds.map(modelId => ({
			user_id: userId,
			model_id: modelId
		}));

		const { error } = await supabaseAdmin
			.from('user_favorite_models')
			.upsert(inserts, {
				onConflict: 'user_id,model_id'
			});

		if (error) {
			throw new Error(`Failed to add favorite models: ${error.message}`);
		}
	} else {
		// Remove favorites
		const { error } = await supabaseAdmin
			.from('user_favorite_models')
			.delete()
			.eq('user_id', userId)
			.in('model_id', modelIds);

		if (error) {
			throw new Error(`Failed to remove favorite models: ${error.message}`);
		}
	}
}