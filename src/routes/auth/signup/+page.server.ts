import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { signUpWithEmail, getOAuthSignInUrl, setAuthCookies } from '$lib/server/auth.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Redirect if already authenticated
	if (locals.session) {
		const redirectTo = url.searchParams.get('redirectTo') || '/dashboard';
		redirect(302, redirectTo);
	}

	return {
		redirectTo: url.searchParams.get('redirectTo')
	};
};

export const actions: Actions = {
	signup: async (event) => {
		const { request, cookies, url } = event;
		const data = await request.formData();
		const email = data.get('email') as string;
		const password = data.get('password') as string;
		const confirmPassword = data.get('confirmPassword') as string;
		const fullName = data.get('fullName') as string;
		const redirectTo = data.get('redirectTo') as string;

		if (!email) {
			return fail(400, {
				email,
				fullName,
				error: 'Email is required'
			});
		}

		if (!password) {
			return fail(400, {
				email,
				fullName,
				error: 'Password is required'
			});
		}

		if (password !== confirmPassword) {
			return fail(400, {
				email,
				fullName,
				error: 'Passwords do not match'
			});
		}

		if (password.length < 8) {
			return fail(400, {
				email,
				fullName,
				error: 'Password must be at least 8 characters long'
			});
		}

		try {
			const { data: authData, error } = await signUpWithEmail(email, password, {
				full_name: fullName || null
			});

			if (error) {
				return fail(400, {
					email,
					fullName,
					error: error.message
				});
			}

			// Check if email confirmation is required
			if (authData.user && !authData.session) {
				return {
					success: true,
					message: 'Please check your email to confirm your account before signing in.',
					email
				};
			}

			// If session was created immediately (email confirmation disabled)
			if (authData.session) {
				// Set authentication cookies
				setAuthCookies(event, authData.session);

				// Return success with redirect info instead of redirecting
				return {
					success: true,
					redirectTo: redirectTo || '/dashboard',
					message: 'Account created successfully! Redirecting...'
				};
			}

			return {
				success: true,
				message: 'Account created successfully. Please check your email to confirm your account.',
				email
			};
		} catch (error) {
			console.error('Signup error:', error);
			return fail(500, {
				email,
				fullName,
				error: 'An unexpected error occurred'
			});
		}
	},

	oauth: async ({ request }) => {
		const data = await request.formData();
		const provider = data.get('provider') as 'google' | 'github';
		const redirectTo = data.get('redirectTo') as string;

		if (!provider || !['google', 'github'].includes(provider)) {
			return fail(400, {
				error: 'Invalid OAuth provider'
			});
		}

		try {
			const { data: authData, error } = await getOAuthSignInUrl(
				provider,
				redirectTo
					? `${process.env.PUBLIC_APP_URL}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`
					: undefined
			);

			if (error || !authData.url) {
				return fail(400, {
					error: error?.message || 'Failed to generate OAuth URL'
				});
			}

			redirect(302, authData.url);
		} catch (error) {
			console.error('OAuth error:', error);
			return fail(500, {
				error: 'An unexpected error occurred'
			});
		}
	}
};
