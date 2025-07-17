import { requireAuth } from '$lib/server/auth.js';
import { getAvailableModels } from '$lib/server/llm.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { user } = await requireAuth(event);
	
	// Get available models from OpenRouter
	let models = [];
	try {
		models = await getAvailableModels();
	} catch (error) {
		console.error('Failed to fetch models:', error);
	}
	
	return {
		user,
		models
	};
};