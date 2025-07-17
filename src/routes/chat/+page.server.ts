import { requireAuth } from '$lib/server/auth.js';
import { getAvailableModels } from '$lib/server/llm.js';
import { getUserChats } from '$lib/server/chats.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { user } = await requireAuth(event);

	// Get available models from OpenRouter
	let models: unknown[] = [];
	try {
		models = await getAvailableModels();
	} catch (error) {
		console.error('Failed to fetch models:', error);
	}

	// Get user's chats
	let chats: unknown[] = [];
	try {
		chats = await getUserChats(user.id);
	} catch (error) {
		console.error('Failed to fetch chats:', error);
	}

	return {
		user,
		models,
		chats
	};
};
