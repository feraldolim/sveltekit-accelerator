import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { getChat, getChatMessages } from '$lib/server/chats.js';
import { getChatFiles } from '$lib/server/chat-files.js';

export const GET: RequestHandler = async (event) => {
	try {
		const { user } = await requireAuth(event);
		const chatId = event.params.id;

		const [chat, messages, files] = await Promise.all([
			getChat(chatId, user.id),
			getChatMessages(chatId, user.id),
			getChatFiles(chatId)
		]);

		if (!chat) {
			error(404, 'Chat not found');
		}

		return json({
			chat,
			messages,
			files
		});
	} catch (err) {
		console.error('Get chat details error:', err);
		if (err instanceof Error && err.message.includes('not found')) {
			error(404, 'Chat not found');
		}
		error(500, 'Failed to fetch chat details');
	}
};