import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { clearAuthCookies } from '$lib/server/auth.js';

export const actions: Actions = {
	default: async (event) => {
		// Clear auth cookies
		clearAuthCookies(event);
		
		// Redirect to home page
		redirect(302, '/');
	}
};