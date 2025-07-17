import { type Handle } from '@sveltejs/kit';
import { getSession } from '$lib/server/auth.js';

export const handle: Handle = async ({ event, resolve }) => {
	// Get user session for every request
	const session = await getSession(event);
	
	// Make session available in locals for use in load functions and endpoints
	event.locals.session = session;
	event.locals.user = session?.user || null;
	
	// Continue with the request
	const response = await resolve(event);
	
	return response;
}; 