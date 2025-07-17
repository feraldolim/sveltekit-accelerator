import { supabase, supabaseAdmin, type Database } from './supabase.js';
import { redirect, type RequestEvent } from '@sveltejs/kit';
import type { User, Session } from '@supabase/supabase-js';

export type AuthSession = {
	user: User;
	session: Session;
};

export type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Get the current user session from the request
 */
export async function getSession(event: RequestEvent): Promise<AuthSession | null> {
	const { cookies } = event;
	
	// Get access token from cookies
	const accessToken = cookies.get('sb-access-token');
	const refreshToken = cookies.get('sb-refresh-token');
	
	if (!accessToken || !refreshToken) {
		return null;
	}
	
	// Set the session
	const { data: { session }, error } = await supabase.auth.setSession({
		access_token: accessToken,
		refresh_token: refreshToken
	});
	
	if (error || !session) {
		// Clear invalid cookies
		cookies.delete('sb-access-token', { path: '/' });
		cookies.delete('sb-refresh-token', { path: '/' });
		return null;
	}
	
	// Update cookies with fresh tokens if they were refreshed
	if (session.access_token !== accessToken) {
		cookies.set('sb-access-token', session.access_token, {
			path: '/',
			maxAge: 60 * 60 * 24 * 7, // 7 days
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});
	}
	
	if (session.refresh_token !== refreshToken) {
		cookies.set('sb-refresh-token', session.refresh_token, {
			path: '/',
			maxAge: 60 * 60 * 24 * 30, // 30 days
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});
	}
	
	return {
		user: session.user,
		session
	};
}

/**
 * Require authentication - redirect to login if not authenticated
 */
export async function requireAuth(event: RequestEvent): Promise<AuthSession> {
	const session = await getSession(event);
	
	if (!session) {
		redirect(302, '/auth/login');
	}
	
	return session;
}

/**
 * Get user profile from database
 */
export async function getUserProfile(userId: string): Promise<Profile | null> {
	const { data, error } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', userId)
		.single();
	
	if (error || !data) {
		return null;
	}
	
	return data;
}

/**
 * Create or update user profile
 */
export async function upsertUserProfile(
	userId: string, 
	profile: Partial<Database['public']['Tables']['profiles']['Insert']>
): Promise<Profile | null> {
	const { data, error } = await supabaseAdmin
		.from('profiles')
		.upsert({
			id: userId,
			updated_at: new Date().toISOString(),
			...profile
		})
		.select()
		.single();
	
	if (error) {
		console.error('Error upserting profile:', error);
		return null;
	}
	
	return data;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string) {
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password
	});
	
	return { data, error };
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email: string, password: string, metadata?: Record<string, unknown>) {
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			data: metadata || {}
		}
	});
	
	return { data, error };
}

/**
 * Sign out user
 */
export async function signOut() {
	const { error } = await supabase.auth.signOut();
	return { error };
}

/**
 * Get sign in URL for OAuth provider
 */
export async function getOAuthSignInUrl(provider: 'google' | 'github', redirectTo?: string) {
	const { data, error } = await supabase.auth.signInWithOAuth({
		provider,
		options: {
			redirectTo: redirectTo || `${process.env.PUBLIC_APP_URL}/auth/callback`
		}
	});
	
	return { data, error };
}

/**
 * Set auth cookies after successful authentication
 */
export function setAuthCookies(event: RequestEvent, session: Session) {
	const { cookies } = event;
	
	cookies.set('sb-access-token', session.access_token, {
		path: '/',
		maxAge: 60 * 60 * 24 * 7, // 7 days
		httpOnly: true,
		secure: true,
		sameSite: 'lax'
	});
	
	cookies.set('sb-refresh-token', session.refresh_token, {
		path: '/',
		maxAge: 60 * 60 * 24 * 30, // 30 days
		httpOnly: true,
		secure: true,
		sameSite: 'lax'
	});
}

/**
 * Clear auth cookies
 */
export function clearAuthCookies(event: RequestEvent) {
	const { cookies } = event;
	
	cookies.delete('sb-access-token', { path: '/' });
	cookies.delete('sb-refresh-token', { path: '/' });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string) {
	const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${process.env.PUBLIC_APP_URL}/auth/reset-password/confirm`
	});
	
	return { data, error };
}

/**
 * Update user password
 */
export async function updatePassword(password: string) {
	const { data, error } = await supabase.auth.updateUser({
		password
	});
	
	return { data, error };
}

/**
 * Check if user has specific role or permission
 */
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
	// This is a placeholder - implement your permission system here
	// You might have a roles table or permissions in the user metadata
	
	const profile = await getUserProfile(userId);
	if (!profile) return false;
	
	// Example: check if user is admin
	if (permission === 'admin') {
		// This could be stored in profile metadata or a separate roles table
		return false; // Implement your logic here
	}
	
	return false;
} 