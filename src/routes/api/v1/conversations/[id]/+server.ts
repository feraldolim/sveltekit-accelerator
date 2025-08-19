import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { supabaseAdmin } from '$lib/server/supabase.js';

export const DELETE: RequestHandler = async (event) => {
	const session = await requireAuth(event);
	const { id } = event.params;
	
	try {
		// First delete all messages in this conversation
		const { error: messagesError } = await supabaseAdmin
			.from('messages')
			.delete()
			.eq('chat_id', id);

		if (messagesError) throw messagesError;

		// Then delete the conversation
		const { data, error } = await supabaseAdmin
			.from('chats')
			.delete()
			.eq('id', id)
			.eq('user_id', session.user.id)
			.select()
			.single();

		if (error) throw error;

		if (!data) {
			return json({ error: 'Conversation not found or not authorized' }, { status: 404 });
		}

		return json({ success: true, message: 'Conversation deleted successfully' });

	} catch (error) {
		console.error('Error deleting conversation:', error);
		return json({ error: 'Failed to delete conversation' }, { status: 500 });
	}
};