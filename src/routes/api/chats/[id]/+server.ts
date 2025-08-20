import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { getChat, getChatMessages, deleteChat, updateChat } from '$lib/server/chats.js';

export const GET: RequestHandler = async (event) => {
	try {
		const { user } = await requireAuth(event);
		const chatId = event.params.id;

		const [chat, messages] = await Promise.all([
			getChat(chatId, user.id),
			getChatMessages(chatId, user.id)
		]);

		if (!chat) {
			error(404, 'Chat not found');
		}

		return json(chat);
	} catch (err) {
		console.error('Get chat error:', err);
		if (err instanceof Error && err.message.includes('not found')) {
			error(404, 'Chat not found');
		}
		error(500, 'Failed to fetch chat');
	}
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const { user } = await requireAuth(event);
		const chatId = event.params.id;
		const body = await event.request.json();

		// Update the chat with the new data
		const updatedChat = await updateChat(chatId, user.id, body);
		
		return json(updatedChat);
	} catch (err) {
		console.error('Update chat error:', err);
		error(500, 'Failed to update chat');
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const { user } = await requireAuth(event);
		const chatId = event.params.id;

		await deleteChat(chatId, user.id);
		
		return json({ success: true });
	} catch (err) {
		console.error('Delete chat error:', err);
		error(500, 'Failed to delete chat');
	}
};