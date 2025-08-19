import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { supabaseAdmin } from '$lib/server/supabase.js';

export const GET: RequestHandler = async (event) => {
	const session = await requireAuth(event);
	
	try {
		const url = new URL(event.request.url);
		const search = url.searchParams.get('search') || '';
		const model = url.searchParams.get('model') || '';
		const limit = parseInt(url.searchParams.get('limit') || '50');
		const offset = parseInt(url.searchParams.get('offset') || '0');

		let query = supabaseAdmin
			.from('chats')
			.select(`
				id,
				title,
				model,
				created_at,
				updated_at,
				messages!inner(
					id,
					role,
					content,
					created_at,
					token_count
				)
			`)
			.eq('user_id', session.user.id)
			.order('updated_at', { ascending: false });

		// Apply filters
		if (search) {
			query = query.ilike('title', `%${search}%`);
		}

		if (model) {
			query = query.eq('model', model);
		}

		// Apply pagination
		query = query.range(offset, offset + limit - 1);

		const { data: conversations, error } = await query;

		if (error) throw error;

		// Process conversations to get stats and latest message
		const processedConversations = conversations?.map(chat => {
			const messages = Array.isArray(chat.messages) ? chat.messages : [];
			const messageCount = messages.length;
			const tokenUsage = messages.reduce((sum, msg) => sum + (msg.token_count || 0), 0);
			const latestMessage = messages.sort((a, b) => 
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
			)[0];

			return {
				id: chat.id,
				title: chat.title,
				model: chat.model,
				message_count: messageCount,
				token_usage: tokenUsage,
				created_at: chat.created_at,
				updated_at: chat.updated_at,
				latest_message: latestMessage ? {
					role: latestMessage.role,
					content: latestMessage.content?.substring(0, 100) + '...',
					created_at: latestMessage.created_at
				} : null
			};
		}) || [];

		// Get overall stats
		const { data: statsData, error: statsError } = await supabaseAdmin
			.from('chats')
			.select('id, messages!inner(token_count)')
			.eq('user_id', session.user.id);

		if (statsError) throw statsError;

		const totalConversations = statsData?.length || 0;
		const totalMessages = statsData?.reduce((sum, chat) => {
			const messages = Array.isArray(chat.messages) ? chat.messages : [];
			return sum + messages.length;
		}, 0) || 0;
		const totalTokens = statsData?.reduce((sum, chat) => {
			const messages = Array.isArray(chat.messages) ? chat.messages : [];
			return sum + messages.reduce((msgSum, msg) => msgSum + (msg.token_count || 0), 0);
		}, 0) || 0;

		// Get active conversations in last 7 days
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const { data: activeData, error: activeError } = await supabaseAdmin
			.from('chats')
			.select('id')
			.eq('user_id', session.user.id)
			.gte('updated_at', sevenDaysAgo.toISOString());

		if (activeError) throw activeError;

		const stats = {
			total_conversations: totalConversations,
			total_messages: totalMessages,
			total_tokens: totalTokens,
			avg_messages_per_conversation: totalConversations > 0 ? totalMessages / totalConversations : 0,
			active_conversations_7d: activeData?.length || 0
		};

		return json({
			conversations: processedConversations,
			stats,
			filters: { search, model }
		});

	} catch (error) {
		console.error('Error fetching conversations:', error);
		return json({ error: 'Failed to fetch conversations' }, { status: 500 });
	}
};