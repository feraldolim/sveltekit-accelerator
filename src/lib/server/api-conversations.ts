import { supabaseAdmin } from './supabase.js';
import { createCompletion, createCompletionStream, truncateMessages, type ChatMessage } from './llm.js';

export interface ApiConversation {
	id: string;
	user_id: string;
	api_key_id?: string;
	title: string;
	system_prompt?: string;
	model: string;
	temperature: number;
	max_tokens?: number;
	metadata: Record<string, any>;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface ApiConversationMessage {
	id: string;
	conversation_id: string;
	role: 'system' | 'user' | 'assistant';
	content: string;
	tokens_used?: number;
	model?: string;
	metadata: Record<string, any>;
	created_at: string;
}

export interface CreateApiConversationRequest {
	title: string;
	system_prompt?: string;
	model?: string;
	temperature?: number;
	max_tokens?: number;
	metadata?: Record<string, any>;
	api_key_id?: string;
}

export interface AddMessageRequest {
	role: 'user' | 'assistant' | 'system';
	content: string;
	metadata?: Record<string, any>;
}

export interface SendMessageRequest {
	content: string;
	include_history?: boolean;
	max_history_messages?: number;
	metadata?: Record<string, any>;
	apiKey?: string;
}

export interface SendMessageResponse {
	user_message: ApiConversationMessage;
	assistant_message: ApiConversationMessage;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * Create a new API conversation
 */
export async function createApiConversation(
	userId: string,
	request: CreateApiConversationRequest
): Promise<ApiConversation> {
	const conversationData = {
		user_id: userId,
		api_key_id: request.api_key_id || null,
		title: request.title,
		system_prompt: request.system_prompt || null,
		model: request.model || 'openai/gpt-3.5-turbo',
		temperature: request.temperature ?? 0.7,
		max_tokens: request.max_tokens || null,
		metadata: request.metadata || {},
		is_active: true
	};

	const { data, error } = await supabaseAdmin
		.from('api_conversations')
		.insert([conversationData])
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to create conversation: ${error.message}`);
	}

	return data;
}

/**
 * List conversations for a user
 */
export async function listApiConversations(
	userId: string,
	options?: {
		api_key_id?: string;
		active_only?: boolean;
		search?: string;
		limit?: number;
		offset?: number;
	}
): Promise<ApiConversation[]> {
	let query = supabaseAdmin
		.from('api_conversations')
		.select('*')
		.eq('user_id', userId);

	// Filter by API key
	if (options?.api_key_id) {
		query = query.eq('api_key_id', options.api_key_id);
	}

	// Filter by active status
	if (options?.active_only !== false) {
		query = query.eq('is_active', true);
	}

	// Search in title
	if (options?.search) {
		query = query.ilike('title', `%${options.search}%`);
	}

	// Pagination
	if (options?.limit) {
		query = query.limit(options.limit);
	}
	if (options?.offset) {
		query = query.range(options.offset, (options.offset + (options.limit || 10)) - 1);
	}

	query = query.order('updated_at', { ascending: false });

	const { data, error } = await query;

	if (error) {
		throw new Error(`Failed to list conversations: ${error.message}`);
	}

	return data || [];
}

/**
 * Get conversation by ID
 */
export async function getApiConversation(
	userId: string,
	conversationId: string
): Promise<ApiConversation | null> {
	const { data, error } = await supabaseAdmin
		.from('api_conversations')
		.select('*')
		.eq('id', conversationId)
		.eq('user_id', userId)
		.single();

	if (error) {
		if (error.code === 'PGRST116') return null; // Not found
		throw new Error(`Failed to get conversation: ${error.message}`);
	}

	return data;
}

/**
 * Update conversation
 */
export async function updateApiConversation(
	userId: string,
	conversationId: string,
	updates: Partial<Pick<ApiConversation, 'title' | 'system_prompt' | 'model' | 'temperature' | 'max_tokens' | 'metadata' | 'is_active'>>
): Promise<ApiConversation> {
	const { data, error } = await supabaseAdmin
		.from('api_conversations')
		.update({
			...updates,
			updated_at: new Date().toISOString()
		})
		.eq('id', conversationId)
		.eq('user_id', userId)
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to update conversation: ${error.message}`);
	}

	return data;
}

/**
 * Delete/deactivate conversation
 */
export async function deleteApiConversation(userId: string, conversationId: string, soft: boolean = true): Promise<boolean> {
	if (soft) {
		// Soft delete - just mark as inactive
		await updateApiConversation(userId, conversationId, { is_active: false });
	} else {
		// Hard delete - remove from database
		const { error } = await supabaseAdmin
			.from('api_conversations')
			.delete()
			.eq('id', conversationId)
			.eq('user_id', userId);

		if (error) {
			throw new Error(`Failed to delete conversation: ${error.message}`);
		}
	}

	return true;
}

/**
 * Add message to conversation
 */
export async function addApiConversationMessage(
	conversationId: string,
	request: AddMessageRequest
): Promise<ApiConversationMessage> {
	const messageData = {
		conversation_id: conversationId,
		role: request.role,
		content: request.content,
		tokens_used: null,
		model: null,
		metadata: request.metadata || {}
	};

	const { data, error } = await supabaseAdmin
		.from('api_conversation_messages')
		.insert([messageData])
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to add message: ${error.message}`);
	}

	// Update conversation timestamp
	await supabaseAdmin
		.from('api_conversations')
		.update({ updated_at: new Date().toISOString() })
		.eq('id', conversationId);

	return data;
}

/**
 * Get messages for a conversation
 */
export async function getApiConversationMessages(
	userId: string,
	conversationId: string,
	options?: {
		limit?: number;
		offset?: number;
		since?: string; // ISO timestamp
	}
): Promise<ApiConversationMessage[]> {
	// First verify user owns the conversation
	const conversation = await getApiConversation(userId, conversationId);
	if (!conversation) {
		throw new Error('Conversation not found');
	}

	let query = supabaseAdmin
		.from('api_conversation_messages')
		.select('*')
		.eq('conversation_id', conversationId);

	// Filter by timestamp
	if (options?.since) {
		query = query.gte('created_at', options.since);
	}

	// Pagination
	if (options?.limit) {
		query = query.limit(options.limit);
	}
	if (options?.offset) {
		query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
	}

	query = query.order('created_at', { ascending: true });

	const { data, error } = await query;

	if (error) {
		throw new Error(`Failed to get messages: ${error.message}`);
	}

	return data || [];
}

/**
 * Send message and get AI response
 */
export async function sendMessage(
	userId: string,
	conversationId: string,
	request: SendMessageRequest
): Promise<SendMessageResponse> {
	// Get conversation
	const conversation = await getApiConversation(userId, conversationId);
	if (!conversation) {
		throw new Error('Conversation not found');
	}

	// Add user message
	const userMessage = await addApiConversationMessage(conversationId, {
		role: 'user',
		content: request.content,
		metadata: request.metadata
	});

	// Get conversation history if requested
	let messages: ChatMessage[] = [];
	
	if (request.include_history !== false) {
		const historyMessages = await getApiConversationMessages(userId, conversationId, {
			limit: request.max_history_messages || 20
		});

		// Convert to ChatMessage format and exclude the message we just added
		messages = historyMessages
			.filter(m => m.id !== userMessage.id)
			.map(m => ({
				role: m.role as ChatMessage['role'],
				content: m.content
			}));
	}

	// Add system prompt if configured
	if (conversation.system_prompt) {
		messages.unshift({
			role: 'system',
			content: conversation.system_prompt
		});
	}

	// Add the current user message
	messages.push({
		role: 'user',
		content: request.content
	});

	// Truncate messages to fit context window
	const truncatedMessages = truncateMessages(messages, 4000);

	try {
		// Get AI response
		const completion = await createCompletion({
			messages: truncatedMessages,
			model: conversation.model,
			temperature: conversation.temperature,
			max_tokens: conversation.max_tokens,
			apiKey: request.apiKey
		});

		const assistantContent = completion.choices[0]?.message?.content || '';

		// Save assistant response
		const assistantMessage = await addApiConversationMessage(conversationId, {
			role: 'assistant',
			content: assistantContent,
			metadata: {
				...request.metadata,
				model: completion.model,
				usage: completion.usage
			}
		});

		// Update message with token usage
		await supabaseAdmin
			.from('api_conversation_messages')
			.update({
				tokens_used: completion.usage?.total_tokens,
				model: completion.model
			})
			.eq('id', assistantMessage.id);

		return {
			user_message: userMessage,
			assistant_message: {
				...assistantMessage,
				tokens_used: completion.usage?.total_tokens,
				model: completion.model
			},
			usage: completion.usage
		};

	} catch (error) {
		// Mark user message with error metadata
		await supabaseAdmin
			.from('api_conversation_messages')
			.update({
				metadata: {
					...userMessage.metadata,
					error: error instanceof Error ? error.message : 'Unknown error'
				}
			})
			.eq('id', userMessage.id);

		throw error;
	}
}

/**
 * Get conversation summary/statistics
 */
export async function getApiConversationSummary(
	userId: string,
	conversationId: string
): Promise<{
	conversation: ApiConversation;
	message_count: number;
	total_tokens: number;
	models_used: string[];
	first_message_at?: string;
	last_message_at?: string;
	participants: string[];
}> {
	const conversation = await getApiConversation(userId, conversationId);
	if (!conversation) {
		throw new Error('Conversation not found');
	}

	const { data: messages, error } = await supabaseAdmin
		.from('api_conversation_messages')
		.select('role, tokens_used, model, created_at')
		.eq('conversation_id', conversationId)
		.order('created_at', { ascending: true });

	if (error) {
		throw new Error(`Failed to get conversation summary: ${error.message}`);
	}

	const messageList = messages || [];
	const totalTokens = messageList.reduce((sum, m) => sum + (m.tokens_used || 0), 0);
	const modelsUsed = [...new Set(messageList.map(m => m.model).filter(Boolean))];
	const participants = [...new Set(messageList.map(m => m.role))];

	return {
		conversation,
		message_count: messageList.length,
		total_tokens: totalTokens,
		models_used: modelsUsed,
		first_message_at: messageList[0]?.created_at,
		last_message_at: messageList[messageList.length - 1]?.created_at,
		participants
	};
}

/**
 * Export conversation to various formats
 */
export async function exportApiConversation(
	userId: string,
	conversationId: string,
	format: 'json' | 'markdown' | 'csv' = 'json'
): Promise<string> {
	const conversation = await getApiConversation(userId, conversationId);
	if (!conversation) {
		throw new Error('Conversation not found');
	}

	const messages = await getApiConversationMessages(userId, conversationId);

	switch (format) {
		case 'json':
			return JSON.stringify({
				conversation,
				messages
			}, null, 2);

		case 'markdown':
			let markdown = `# ${conversation.title}\n\n`;
			markdown += `**Model**: ${conversation.model}\n`;
			markdown += `**Created**: ${new Date(conversation.created_at).toLocaleString()}\n\n`;
			
			if (conversation.system_prompt) {
				markdown += `## System Prompt\n${conversation.system_prompt}\n\n`;
			}

			markdown += `## Messages\n\n`;
			for (const message of messages) {
				const timestamp = new Date(message.created_at).toLocaleString();
				const roleEmoji = message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : '⚙️';
				markdown += `### ${roleEmoji} ${message.role.charAt(0).toUpperCase() + message.role.slice(1)} (${timestamp})\n\n`;
				markdown += `${message.content}\n\n`;
			}
			return markdown;

		case 'csv':
			const csvRows = [
				['timestamp', 'role', 'content', 'tokens', 'model'].join(',')
			];
			
			for (const message of messages) {
				const row = [
					message.created_at,
					message.role,
					`"${message.content.replace(/"/g, '""')}"`,
					message.tokens_used || '',
					message.model || ''
				].join(',');
				csvRows.push(row);
			}
			return csvRows.join('\n');

		default:
			throw new Error(`Unsupported export format: ${format}`);
	}
}

/**
 * Clone/fork a conversation
 */
export async function forkApiConversation(
	userId: string,
	conversationId: string,
	newTitle?: string,
	includeMessages: boolean = false
): Promise<ApiConversation> {
	const original = await getApiConversation(userId, conversationId);
	if (!original) {
		throw new Error('Conversation not found');
	}

	// Create new conversation
	const forkedConversation = await createApiConversation(userId, {
		title: newTitle || `${original.title} (Copy)`,
		system_prompt: original.system_prompt,
		model: original.model,
		temperature: original.temperature,
		max_tokens: original.max_tokens,
		metadata: {
			...original.metadata,
			forked_from: original.id,
			forked_at: new Date().toISOString()
		}
	});

	// Copy messages if requested
	if (includeMessages) {
		const messages = await getApiConversationMessages(userId, conversationId);
		
		for (const message of messages) {
			await addApiConversationMessage(forkedConversation.id, {
				role: message.role,
				content: message.content,
				metadata: message.metadata
			});
		}
	}

	return forkedConversation;
}

/**
 * Search conversations by content
 */
export async function searchApiConversations(
	userId: string,
	query: string,
	options?: {
		limit?: number;
		offset?: number;
		search_messages?: boolean;
	}
): Promise<{
	conversations: ApiConversation[];
	message_matches?: Array<{
		conversation_id: string;
		message: ApiConversationMessage;
		conversation_title: string;
	}>;
}> {
	const limit = options?.limit || 10;
	const offset = options?.offset || 0;

	// Search conversation titles
	const { data: conversations, error: convError } = await supabaseAdmin
		.from('api_conversations')
		.select('*')
		.eq('user_id', userId)
		.eq('is_active', true)
		.or(`title.ilike.%${query}%,system_prompt.ilike.%${query}%`)
		.order('updated_at', { ascending: false })
		.range(offset, offset + limit - 1);

	if (convError) {
		throw new Error(`Failed to search conversations: ${convError.message}`);
	}

	const result: any = {
		conversations: conversations || []
	};

	// Search message content if requested
	if (options?.search_messages !== false) {
		const { data: messageMatches, error: msgError } = await supabaseAdmin
			.from('api_conversation_messages')
			.select(`
				*,
				api_conversations!inner(id, title, user_id)
			`)
			.eq('api_conversations.user_id', userId)
			.eq('api_conversations.is_active', true)
			.ilike('content', `%${query}%`)
			.order('created_at', { ascending: false })
			.limit(20);

		if (msgError) {
			throw new Error(`Failed to search messages: ${msgError.message}`);
		}

		result.message_matches = (messageMatches || []).map((match: any) => ({
			conversation_id: match.conversation_id,
			message: {
				id: match.id,
				conversation_id: match.conversation_id,
				role: match.role,
				content: match.content,
				tokens_used: match.tokens_used,
				model: match.model,
				metadata: match.metadata,
				created_at: match.created_at
			},
			conversation_title: match.api_conversations.title
		}));
	}

	return result;
}