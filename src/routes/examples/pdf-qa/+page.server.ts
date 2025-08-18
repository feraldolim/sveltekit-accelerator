import { requireAuth } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Require authentication for this feature
	const session = await requireAuth(event);

	return {
		user: session.user
	};
};

