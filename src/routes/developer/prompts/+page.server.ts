import { requireAuth } from '$lib/server/auth.js';
import { listSystemPrompts, getPromptCategories } from '$lib/server/system-prompts.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { url } = event;
	const session = await requireAuth(event);
	
	const category = url.searchParams.get('category') || undefined;
	const search = url.searchParams.get('search') || undefined;
	
	try {
		const [prompts, categories] = await Promise.all([
			listSystemPrompts(session.user.id, {
				category,
				search,
				include_public: true,
				limit: 50
			}),
			getPromptCategories(session.user.id)
		]);
		
		return {
			prompts: prompts || [],
			categories: categories || [],
			filters: {
				category,
				search
			}
		};
	} catch (error) {
		console.error('Error loading system prompts:', error);
		return {
			prompts: [],
			categories: [],
			filters: {
				category,
				search
			}
		};
	}
};