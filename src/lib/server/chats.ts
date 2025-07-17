import { supabaseAdmin } from './supabase.js';
import type { Database } from './database.types.js';

export type Chat = Database['public']['Tables']['chats']['Row'];
export type ChatInsert = Database['public']['Tables']['chats']['Insert'];
export type ChatUpdate = Database['public']['Tables']['chats']['Update'];

export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];

/**
 * Create a new chat session
 */
export async function createChat(
	userId: string,
	title: string = 'New Chat',
	model: string = 'moonshotai/kimi-k2:free',
	systemPrompt?: string
): Promise<Chat> {
	const { data, error } = await supabaseAdmin
		.from('chats')
		.insert({
			user_id: userId,
			title,
			model,
			system_prompt: systemPrompt
		})
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to create chat: ${error.message}`);
	}

	return data;
}

/**
 * Get all chats for a user
 */
export async function getUserChats(userId: string): Promise<Chat[]> {
	const { data, error } = await supabaseAdmin
		.from('chats')
		.select('*')
		.eq('user_id', userId)
		.order('updated_at', { ascending: false });

	if (error) {
		throw new Error(`Failed to fetch chats: ${error.message}`);
	}

	return data || [];
}

/**
 * Get a specific chat by ID
 */
export async function getChat(chatId: string, userId: string): Promise<Chat | null> {
	const { data, error } = await supabaseAdmin
		.from('chats')
		.select('*')
		.eq('id', chatId)
		.eq('user_id', userId)
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			return null; // Chat not found
		}
		throw new Error(`Failed to fetch chat: ${error.message}`);
	}

	return data;
}

/**
 * Update a chat
 */
export async function updateChat(
	chatId: string,
	userId: string,
	updates: ChatUpdate
): Promise<Chat> {
	const { data, error } = await supabaseAdmin
		.from('chats')
		.update(updates)
		.eq('id', chatId)
		.eq('user_id', userId)
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to update chat: ${error.message}`);
	}

	return data;
}

/**
 * Delete a chat and all its messages
 */
export async function deleteChat(chatId: string, userId: string): Promise<void> {
	const { error } = await supabaseAdmin
		.from('chats')
		.delete()
		.eq('id', chatId)
		.eq('user_id', userId);

	if (error) {
		throw new Error(`Failed to delete chat: ${error.message}`);
	}
}

/**
 * Add a message to a chat
 */
export async function addMessage(
	chatId: string,
	role: 'user' | 'assistant' | 'system',
	content: string,
	model?: string,
	tokenCount?: number
): Promise<Message> {
	const { data, error } = await supabaseAdmin
		.from('messages')
		.insert({
			chat_id: chatId,
			role,
			content,
			model,
			token_count: tokenCount
		})
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to add message: ${error.message}`);
	}

	return data;
}

/**
 * Get all messages for a chat
 */
export async function getChatMessages(chatId: string, userId: string): Promise<Message[]> {
	// First verify the user owns this chat
	const chat = await getChat(chatId, userId);
	if (!chat) {
		throw new Error('Chat not found or access denied');
	}

	const { data, error } = await supabaseAdmin
		.from('messages')
		.select('*')
		.eq('chat_id', chatId)
		.order('created_at', { ascending: true });

	if (error) {
		throw new Error(`Failed to fetch messages: ${error.message}`);
	}

	return data || [];
}

/**
 * Generate a title for a chat based on the first message
 */
export function generateChatTitle(firstMessage: string): string {
	// Take first 50 characters of the message and clean it up
	const title = firstMessage
		.trim()
		.substring(0, 50)
		.replace(/\s+/g, ' ')
		.trim();
	
	return title.length > 0 ? (title.length === 50 ? title + '...' : title) : 'New Chat';
}

/**
 * Auto-update chat title when first message is sent
 */
export async function updateChatTitle(chatId: string, userId: string, firstMessage: string): Promise<void> {
	const title = generateChatTitle(firstMessage);
	await updateChat(chatId, userId, { title });
}