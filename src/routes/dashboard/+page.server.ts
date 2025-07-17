import { requireAuth, getUserProfile } from '$lib/server/auth.js';
import { getDashboardStats } from '$lib/server/dashboard.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { user } = await requireAuth(event);

	// Get user profile and dashboard stats
	const [profile, dashboardStats] = await Promise.all([
		getUserProfile(user.id),
		getDashboardStats(user.id)
	]);

	return {
		user,
		profile,
		stats: dashboardStats
	};
};
