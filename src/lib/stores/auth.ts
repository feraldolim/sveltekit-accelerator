import { writable, derived, type Readable } from 'svelte/store';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { User, Session } from '@supabase/supabase-js';

// Create Supabase client for browser
const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

// Auth state stores
export const user = writable<User | null>(null);
export const session = writable<Session | null>(null);
export const loading = writable<boolean>(true);

// Profile store (separate from auth user)
export const profile = writable<{
	id: string;
	username: string | null;
	full_name: string | null;
	avatar_url: string | null;
	bio: string | null;
	created_at: string;
	updated_at: string;
} | null>(null);

// Derived stores
export const isAuthenticated: Readable<boolean> = derived(user, ($user) => $user !== null);

export const isLoading: Readable<boolean> = derived(loading, ($loading) => $loading);

/**
 * Initialize auth state
 */
export async function initializeAuth() {
	loading.set(true);

	try {
		// Get initial session
		const {
			data: { session: initialSession }
		} = await supabase.auth.getSession();

		if (initialSession) {
			session.set(initialSession);
			user.set(initialSession.user);
			await loadUserProfile(initialSession.user.id);
		}

		// Listen for auth changes
		supabase.auth.onAuthStateChange(async (event, newSession) => {
			session.set(newSession);
			user.set(newSession?.user ?? null);

			if (newSession?.user) {
				await loadUserProfile(newSession.user.id);
			} else {
				profile.set(null);
			}
		});
	} catch (error) {
		console.error('Error initializing auth:', error);
	} finally {
		loading.set(false);
	}
}

/**
 * Load user profile from database
 */
async function loadUserProfile(userId: string) {
	try {
		const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

		if (error && error.code !== 'PGRST116') {
			console.error('Error loading profile:', error);
			return;
		}

		profile.set(data);
	} catch (error) {
		console.error('Error loading profile:', error);
	}
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
	loading.set(true);

	try {
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (error) throw error;

		return { data, error: null };
	} catch (error) {
		console.error('Sign in error:', error);
		return { data: null, error };
	} finally {
		loading.set(false);
	}
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, metadata?: Record<string, unknown>) {
	loading.set(true);

	try {
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: metadata || {}
			}
		});

		if (error) throw error;

		return { data, error: null };
	} catch (error) {
		console.error('Sign up error:', error);
		return { data: null, error };
	} finally {
		loading.set(false);
	}
}

/**
 * Sign in with OAuth provider
 */
export async function signInWithOAuth(provider: 'google' | 'github') {
	loading.set(true);

	try {
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider,
			options: {
				redirectTo: `${window.location.origin}/auth/callback`
			}
		});

		if (error) throw error;

		return { data, error: null };
	} catch (error) {
		console.error('OAuth sign in error:', error);
		return { data: null, error };
	} finally {
		loading.set(false);
	}
}

/**
 * Sign out
 */
export async function signOut() {
	loading.set(true);

	try {
		const { error } = await supabase.auth.signOut();

		if (error) throw error;

		// Clear stores
		user.set(null);
		session.set(null);
		profile.set(null);

		return { error: null };
	} catch (error) {
		console.error('Sign out error:', error);
		return { error };
	} finally {
		loading.set(false);
	}
}

/**
 * Update user profile
 */
export async function updateProfile(updates: {
	username?: string;
	full_name?: string;
	avatar_url?: string;
	bio?: string;
}) {
	const {
		data: { user: currentUser }
	} = await supabase.auth.getUser();
	if (!currentUser) throw new Error('No authenticated user');

	try {
		const { data, error } = await supabase
			.from('profiles')
			.update({
				...updates,
				updated_at: new Date().toISOString()
			})
			.eq('id', currentUser.id)
			.select()
			.single();

		if (error) throw error;

		profile.set(data);
		return { data, error: null };
	} catch (error) {
		console.error('Profile update error:', error);
		return { data: null, error };
	}
}

/**
 * Reset password
 */
export async function resetPassword(email: string) {
	try {
		const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${window.location.origin}/auth/reset-password`
		});

		if (error) throw error;

		return { data, error: null };
	} catch (error) {
		console.error('Password reset error:', error);
		return { data: null, error };
	}
}

/**
 * Update password
 */
export async function updatePassword(password: string) {
	try {
		const { data, error } = await supabase.auth.updateUser({
			password
		});

		if (error) throw error;

		return { data, error: null };
	} catch (error) {
		console.error('Password update error:', error);
		return { data: null, error };
	}
}
