import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { addMessage, getChat, updateChatTitle } from '$lib/server/chats.js';

export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireAuth(event);
		const chatId = event.params.id;
		const { role, content, model, token_count, is_first_message } = await event.request.json();

		// Verify the user owns this chat
		const chat = await getChat(chatId, user.id);
		if (!chat) {
			error(404, 'Chat not found');
		}

		// Add the message
		const message = await addMessage(chatId, role, content, model, token_count);

		// If this is the first user message, update the chat title
		if (is_first_message && role === 'user') {
			await updateChatTitle(chatId, user.id, content);
		}

		return json(message);
	} catch (err) {
		console.error('Add message error:', err);
		if (err instanceof Error && err.message.includes('not found')) {
			error(404, 'Chat not found');
		}
		error(500, 'Failed to add message');
	}
};