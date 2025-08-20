import { requireAuth } from '$lib/server/auth.js';
import { getAvailableModels } from '$lib/server/llm.js';
import { getUserChats } from '$lib/server/chats.js';
import { listSystemPrompts } from '$lib/server/system-prompts.js';
import { listStructuredOutputs } from '$lib/server/structured-outputs.js';
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

	// Get user's system prompts (including public ones)
	let systemPrompts: unknown[] = [];
	try {
		systemPrompts = await listSystemPrompts(user.id, {
			include_public: true,
			limit: 100
		});
	} catch (error) {
		console.error('Failed to fetch system prompts:', error);
	}

	// Get user's structured outputs (including public ones)
	let structuredOutputs: unknown[] = [];
	try {
		structuredOutputs = await listStructuredOutputs(user.id, {
			include_public: true,
			limit: 100
		});
	} catch (error) {
		console.error('Failed to fetch structured outputs:', error);
	}

	return {
		user,
		models,
		chats,
		systemPrompts,
		structuredOutputs
	};
};
