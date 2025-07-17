import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { signInWithEmail, getOAuthSignInUrl } from '$lib/server/auth.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Redirect if already authenticated
	if (locals.session) {
		const redirectTo = url.searchParams.get('redirectTo') || '/dashboard';
		redirect(302, redirectTo);
	}

	return {
		redirectTo: url.searchParams.get('redirectTo'),
		success: url.searchParams.get('success'),
		error: url.searchParams.get('error'),
		message: url.searchParams.get('message')
	};
};

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email') as string;
		const password = data.get('password') as string;
		const redirectTo = data.get('redirectTo') as string;


		if (!email) {
			return fail(400, {
				email,
				error: 'Email is required'
			});
		}

		if (!password) {
			return fail(400, {
				email,
				error: 'Password is required'
			});
		}

		const { data: authData, error } = await signInWithEmail(email, password);

		if (error) {
			return fail(400, {
				email,
				error: error.message
			});
		}

		if (!authData.session) {
			return fail(400, {
				email,
				error: 'Failed to create session'
			});
		}

		// Set auth cookies
		cookies.set('sb-access-token', authData.session.access_token, {
			path: '/',
			maxAge: 60 * 60 * 24 * 7, // 7 days
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});
		
		cookies.set('sb-refresh-token', authData.session.refresh_token, {
			path: '/',
			maxAge: 60 * 60 * 24 * 30, // 30 days
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});

		// Redirect to intended destination or dashboard
		redirect(302, redirectTo || '/dashboard');
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
				redirectTo ? `${process.env.PUBLIC_APP_URL}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}` : undefined
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