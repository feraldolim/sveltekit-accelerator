import { requireAuth } from '$lib/server/auth.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const session = await requireAuth(event);
	
	return {
		user: session.user
	};
};