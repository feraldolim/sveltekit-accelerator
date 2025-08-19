import { requireAuth } from '$lib/server/auth.js';
import { listApiKeys } from '$lib/server/api-keys.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const session = await requireAuth(event);
	
	try {
		const apiKeys = await listApiKeys(session.user.id);
		
		return {
			apiKeys
		};
	} catch (error) {
		console.error('Error loading API keys:', error);
		return {
			apiKeys: []
		};
	}
};