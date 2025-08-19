import { requireAuth } from '$lib/server/auth.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { url } = event;
	const session = await requireAuth(event);
	
	const search = url.searchParams.get('search') || undefined;
	const limit = 20;
	
	try {
		// Get conversations with message counts and latest message
		let query = supabaseAdmin
			.from('chats')
			.select(`
				*,
				message_count:messages(count),
				latest_message:messages!messages_chat_id_fkey(
					content,
					role,
					created_at
				)
			`)
			.eq('user_id', session.user.id)
			.order('updated_at', { ascending: false })
			.limit(limit);

		if (search) {
			query = query.or(`title.ilike.%${search}%,messages.content.ilike.%${search}%`);
		}

		const { data: conversations, error } = await query;

		if (error) {
			console.error('Error loading conversations:', error);
			return {
				conversations: [],
				filters: { search }
			};
		}

		// Transform the data to get proper message counts and latest messages
		const transformedConversations = conversations?.map(chat => {
			const messageCount = Array.isArray(chat.message_count) ? chat.message_count.length : 0;
			const latestMessage = Array.isArray(chat.latest_message) 
				? chat.latest_message.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
				: null;

			return {
				...chat,
				message_count: messageCount,
				latest_message: latestMessage
			};
		}) || [];
		
		return {
			conversations: transformedConversations,
			filters: { search }
		};
	} catch (error) {
		console.error('Error loading conversations:', error);
		return {
			conversations: [],
			filters: { search }
		};
	}
};