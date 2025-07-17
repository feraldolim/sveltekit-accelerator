import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { sendPasswordResetEmail } from '$lib/server/auth.js';

export const load: PageServerLoad = async ({ locals }) => {
	// Redirect if already authenticated
	if (locals.session) {
		redirect(302, '/dashboard');
	}

	return {};
};

export const actions: Actions = {
	reset: async ({ request }) => {
		const data = await request.formData();
		const email = data.get('email') as string;

		if (!email) {
			return fail(400, {
				email,
				error: 'Email is required'
			});
		}

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return fail(400, {
				email,
				error: 'Please enter a valid email address'
			});
		}

		try {
			const { error } = await sendPasswordResetEmail(email);

			if (error) {
				return fail(400, {
					email,
					error: error.message
				});
			}

			return {
				success: true,
				message: "If an account with that email exists, we've sent you a password reset link.",
				email
			};
		} catch (error) {
			console.error('Password reset error:', error);
			return fail(500, {
				email,
				error: 'An unexpected error occurred'
			});
		}
	}
};
