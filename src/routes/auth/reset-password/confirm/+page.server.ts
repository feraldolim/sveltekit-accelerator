import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { updatePassword } from '$lib/server/auth.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Check if user is authenticated (they should be after clicking the reset link)
	if (!locals.session) {
		// If no session, redirect to login with error
		redirect(302, '/auth/login?error=Invalid or expired reset link');
	}

	return {};
};

export const actions: Actions = {
	confirm: async ({ request, locals }) => {
		const data = await request.formData();
		const password = data.get('password') as string;
		const confirmPassword = data.get('confirmPassword') as string;

		if (!password) {
			return fail(400, {
				error: 'Password is required'
			});
		}

		if (password.length < 8) {
			return fail(400, {
				error: 'Password must be at least 8 characters long'
			});
		}

		if (password !== confirmPassword) {
			return fail(400, {
				error: 'Passwords do not match'
			});
		}

		try {
			const { error } = await updatePassword(password);

			if (error) {
				return fail(400, {
					error: error.message
				});
			}

			// Redirect to login with success message
			redirect(
				302,
				'/auth/login?success=Password updated successfully. Please sign in with your new password.'
			);
		} catch (error) {
			console.error('Password update error:', error);
			return fail(500, {
				error: 'An unexpected error occurred'
			});
		}
	}
};
