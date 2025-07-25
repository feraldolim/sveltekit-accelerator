// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { User } from '@supabase/supabase-js';
import type { AuthSession } from '$lib/server/auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: AuthSession | null;
			user: User | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
