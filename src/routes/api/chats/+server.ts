import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { createChat, getUserChats } from '$lib/server/chats.js';

export const GET: RequestHandler = async (event) => {
	try {
		const { user } = await requireAuth(event);
		const chats = await getUserChats(user.id);
		
		return json(chats);
	} catch (err) {
		console.error('Get chats error:', err);
		error(500, 'Failed to fetch chats');
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireAuth(event);
		const { title, model, system_prompt } = await event.request.json();

		const chat = await createChat(user.id, title, model, system_prompt);
		
		return json(chat);
	} catch (err) {
		console.error('Create chat error:', err);
		error(500, 'Failed to create chat');
	}
};