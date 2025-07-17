import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/server/supabase.js';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');
	const redirectTo = url.searchParams.get('redirectTo') || '/dashboard';

	if (error) {
		console.error('OAuth error:', error, errorDescription);
		redirect(302, `/auth/login?error=${encodeURIComponent(errorDescription || error)}`);
	}

	if (!code) {
		redirect(302, '/auth/login?error=No authorization code received');
	}

	try {
		// Exchange the code for a session
		const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

		if (exchangeError || !data.session) {
			console.error('Token exchange error:', exchangeError);
			redirect(302, `/auth/login?error=${encodeURIComponent('Failed to complete authentication')}`);
		}

		// Set auth cookies
		cookies.set('sb-access-token', data.session.access_token, {
			path: '/',
			maxAge: 60 * 60 * 24 * 7, // 7 days
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});

		cookies.set('sb-refresh-token', data.session.refresh_token, {
			path: '/',
			maxAge: 60 * 60 * 24 * 30, // 30 days
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});

		// Redirect to intended destination
		redirect(302, redirectTo);
	} catch (error) {
		console.error('Callback error:', error);
		redirect(302, `/auth/login?error=${encodeURIComponent('An unexpected error occurred')}`);
	}
};
