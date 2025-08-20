import { supabaseAdmin } from './supabase.js';
import type { Database } from './database.types.js';

type FileUpload = Database['public']['Tables']['file_uploads']['Row'];
type FileUploadInsert = Database['public']['Tables']['file_uploads']['Insert'];

export interface FileAttachment {
	filename: string;
	file_type: 'pdf' | 'image' | 'audio';
	file_size: number;
	mime_type: string;
}

/**
 * Record file attachments for a chat message
 */
export async function recordChatFiles(
	userId: string,
	chatId: string,
	messageId: string,
	attachments: FileAttachment[]
): Promise<FileUpload[]> {
	if (attachments.length === 0) {
		return [];
	}

	const fileUploads: FileUploadInsert[] = attachments.map(attachment => ({
		user_id: userId,
		chat_id: chatId,
		message_id: messageId,
		original_name: attachment.filename,
		file_path: `chat/${chatId}/${messageId}/${attachment.filename}`, // Virtual path for chat attachments
		mime_type: attachment.mime_type,
		file_size: attachment.file_size,
		file_type: attachment.file_type,
		processing_status: 'completed', // Chat attachments are processed immediately
		is_public: false
	}));

	console.log('Inserting file uploads:', fileUploads);
	
	const { data, error } = await supabaseAdmin
		.from('file_uploads')
		.insert(fileUploads)
		.select();

	if (error) {
		console.error('Database error when inserting file uploads:', {
			error: error,
			code: error.code,
			message: error.message,
			details: error.details,
			fileUploads: fileUploads
		});
		throw new Error(`Failed to record chat files: ${error.message} (Code: ${error.code})`);
	}

	return data || [];
}

/**
 * Get all files for a chat
 */
export async function getChatFiles(chatId: string): Promise<FileUpload[]> {
	const { data, error } = await supabaseAdmin
		.from('file_uploads')
		.select('*')
		.eq('chat_id', chatId)
		.order('created_at', { ascending: true });

	if (error) {
		throw new Error(`Failed to get chat files: ${error.message}`);
	}

	return data || [];
}

/**
 * Get files for a specific message
 */
export async function getMessageFiles(messageId: string): Promise<FileUpload[]> {
	const { data, error } = await supabaseAdmin
		.from('file_uploads')
		.select('*')
		.eq('message_id', messageId)
		.order('created_at', { ascending: true });

	if (error) {
		throw new Error(`Failed to get message files: ${error.message}`);
	}

	return data || [];
}

/**
 * Delete files for a message
 */
export async function deleteMessageFiles(messageId: string): Promise<void> {
	const { error } = await supabaseAdmin
		.from('file_uploads')
		.delete()
		.eq('message_id', messageId);

	if (error) {
		throw new Error(`Failed to delete message files: ${error.message}`);
	}
}

/**
 * Delete all files for a chat
 */
export async function deleteChatFiles(chatId: string): Promise<void> {
	const { error } = await supabaseAdmin
		.from('file_uploads')
		.delete()
		.eq('chat_id', chatId);

	if (error) {
		throw new Error(`Failed to delete chat files: ${error.message}`);
	}
}

/**
 * Get file statistics for a user
 */
export async function getUserFileStats(userId: string): Promise<{
	total_files: number;
	total_size: number;
	by_type: Record<string, { count: number; size: number }>;
}> {
	const { data, error } = await supabaseAdmin
		.from('file_uploads')
		.select(`
			file_type,
			file_size,
			chats!inner(user_id)
		`)
		.eq('chats.user_id', userId);

	if (error) {
		throw new Error(`Failed to get user file stats: ${error.message}`);
	}

	const stats = {
		total_files: data?.length || 0,
		total_size: 0,
		by_type: {} as Record<string, { count: number; size: number }>
	};

	data?.forEach(file => {
		const size = file.file_size || 0;
		stats.total_size += size;
		
		if (!stats.by_type[file.file_type]) {
			stats.by_type[file.file_type] = { count: 0, size: 0 };
		}
		
		stats.by_type[file.file_type].count++;
		stats.by_type[file.file_type].size += size;
	});

	return stats;
}