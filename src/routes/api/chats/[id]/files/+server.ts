import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { getChatFiles } from '$lib/server/chat-files.js';
import { getChat } from '$lib/server/chats.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const { user } = await requireAuth({ locals } as any);
		const chatId = params.id!;

		// Verify the user owns this chat
		const chat = await getChat(chatId, user.id);
		if (!chat) {
			return json({ error: 'Chat not found or not authorized' }, { status: 404 });
		}

		// Get all files for this chat
		const files = await getChatFiles(chatId);

		return json({
			chat_id: chatId,
			files: files.map(file => ({
				id: file.id,
				filename: file.original_name,
				file_type: file.file_type,
				file_size: file.file_size,
				mime_type: file.mime_type,
				created_at: file.created_at
			}))
		});
	} catch (error) {
		console.error('Error fetching chat files:', error);
		return json({ error: 'Failed to fetch chat files' }, { status: 500 });
	}
};