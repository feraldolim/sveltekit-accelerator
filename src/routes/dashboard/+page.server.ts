import { requireAuth, getUserProfile } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { user } = await requireAuth(event);
	
	// Get user profile
	const profile = await getUserProfile(user.id);
	
	return {
		user,
		profile
	};
};