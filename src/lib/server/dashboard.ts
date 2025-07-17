import { supabase } from './supabase.js';
import type { Database } from './supabase.js';

export interface DashboardStats {
	totalChats: number;
	totalMessages: number;
	apiUsage: {
		total: number;
		thisMonth: number;
		tokensUsed: number;
	};
	storageUsage: {
		totalFiles: number;
		totalSize: number;
		byBucket: Record<string, { count: number; size: number }>;
	};
	recentActivity: Array<{
		id: string;
		action: string;
		details: string;
		timestamp: Date;
		type: 'chat' | 'api' | 'storage' | 'auth';
	}>;
}

/**
 * Get dashboard statistics for a user
 */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
	const [
		chatsStats,
		messagesStats,
		apiStats,
		storageStats,
		recentActivity
	] = await Promise.all([
		getChatStats(userId),
		getMessageStats(userId),
		getApiStats(userId),
		getStorageStats(userId),
		getRecentActivity(userId)
	]);

	return {
		totalChats: chatsStats.total,
		totalMessages: messagesStats.total,
		apiUsage: apiStats,
		storageUsage: storageStats,
		recentActivity
	};
}

/**
 * Get chat statistics
 */
async function getChatStats(userId: string) {
	const { data, error } = await supabase
		.from('chats')
		.select('id, created_at')
		.eq('user_id', userId);

	if (error) {
		console.error('Error fetching chat stats:', error);
		return { total: 0, thisMonth: 0 };
	}

	const total = data?.length || 0;
	const thisMonth = data?.filter(chat => {
		const chatDate = new Date(chat.created_at);
		const now = new Date();
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
		return chatDate >= monthStart;
	}).length || 0;

	return { total, thisMonth };
}

/**
 * Get message statistics
 */
async function getMessageStats(userId: string) {
	const { data, error } = await supabase
		.from('messages')
		.select('id, created_at, chat_id!inner(user_id)')
		.eq('chat_id.user_id', userId);

	if (error) {
		console.error('Error fetching message stats:', error);
		return { total: 0, thisMonth: 0 };
	}

	const total = data?.length || 0;
	const thisMonth = data?.filter(message => {
		const messageDate = new Date(message.created_at);
		const now = new Date();
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
		return messageDate >= monthStart;
	}).length || 0;

	return { total, thisMonth };
}

/**
 * Get API usage statistics
 */
async function getApiStats(userId: string) {
	const { data, error } = await supabase
		.from('api_usage')
		.select('tokens_used, created_at')
		.eq('user_id', userId);

	if (error) {
		console.error('Error fetching API stats:', error);
		return { total: 0, thisMonth: 0, tokensUsed: 0 };
	}

	const total = data?.length || 0;
	const tokensUsed = data?.reduce((sum, usage) => sum + (usage.tokens_used || 0), 0) || 0;
	
	const thisMonth = data?.filter(usage => {
		const usageDate = new Date(usage.created_at);
		const now = new Date();
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
		return usageDate >= monthStart;
	}).length || 0;

	return { total, thisMonth, tokensUsed };
}

/**
 * Get storage usage statistics
 */
async function getStorageStats(userId: string) {
	const { data, error } = await supabase
		.from('storage_usage')
		.select('bucket, file_size, deleted_at')
		.eq('user_id', userId)
		.is('deleted_at', null);

	if (error) {
		console.error('Error fetching storage stats:', error);
		return { 
			totalFiles: 0, 
			totalSize: 0, 
			byBucket: {} 
		};
	}

	const totalFiles = data?.length || 0;
	const totalSize = data?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;
	
	const byBucket = data?.reduce((acc, file) => {
		if (!acc[file.bucket]) {
			acc[file.bucket] = { count: 0, size: 0 };
		}
		acc[file.bucket].count++;
		acc[file.bucket].size += file.file_size || 0;
		return acc;
	}, {} as Record<string, { count: number; size: number }>) || {};

	return { totalFiles, totalSize, byBucket };
}

/**
 * Get recent activity
 */
async function getRecentActivity(userId: string) {
	const { data, error } = await supabase
		.from('user_activity')
		.select('id, action, details, created_at')
		.eq('user_id', userId)
		.order('created_at', { ascending: false })
		.limit(10);

	if (error) {
		console.error('Error fetching recent activity:', error);
		return [];
	}

	return data?.map(activity => ({
		id: activity.id,
		action: activity.action,
		details: getActivityDetails(activity.action, activity.details),
		timestamp: new Date(activity.created_at),
		type: getActivityType(activity.action)
	})) || [];
}

/**
 * Get activity type based on action
 */
function getActivityType(action: string): 'chat' | 'api' | 'storage' | 'auth' {
	if (action.includes('chat') || action.includes('message')) return 'chat';
	if (action.includes('api') || action.includes('completion')) return 'api';
	if (action.includes('upload') || action.includes('file')) return 'storage';
	return 'auth';
}

/**
 * Get human-readable activity details
 */
function getActivityDetails(action: string, details: any): string {
	switch (action) {
		case 'chat_created':
			return `Created new chat: ${details?.title || 'Untitled'}`;
		case 'message_sent':
			return `Sent message in chat`;
		case 'file_uploaded':
			return `Uploaded file: ${details?.filename || 'unknown'}`;
		case 'api_call':
			return `API call to ${details?.endpoint || 'unknown endpoint'}`;
		case 'login':
			return `Logged in from ${details?.ip || 'unknown IP'}`;
		case 'profile_updated':
			return `Updated profile information`;
		default:
			return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
	}
}

/**
 * Log user activity
 */
export async function logUserActivity(
	userId: string,
	action: string,
	details?: any,
	ipAddress?: string,
	userAgent?: string
) {
	const { error } = await supabase
		.from('user_activity')
		.insert({
			user_id: userId,
			action,
			details,
			ip_address: ipAddress,
			user_agent: userAgent
		});

	if (error) {
		console.error('Error logging user activity:', error);
	}
}

/**
 * Log API usage
 */
export async function logApiUsage(
	userId: string,
	endpoint: string,
	method: string,
	model?: string,
	tokensUsed?: number,
	responseTime?: number,
	statusCode?: number,
	errorMessage?: string
) {
	const { error } = await supabase
		.from('api_usage')
		.insert({
			user_id: userId,
			endpoint,
			method,
			model,
			tokens_used: tokensUsed,
			response_time: responseTime,
			status_code: statusCode,
			error_message: errorMessage
		});

	if (error) {
		console.error('Error logging API usage:', error);
	}
}

/**
 * Log storage usage
 */
export async function logStorageUsage(
	userId: string,
	bucket: string,
	filePath: string,
	fileSize: number,
	mimeType?: string
) {
	const { error } = await supabase
		.from('storage_usage')
		.insert({
			user_id: userId,
			bucket,
			file_path: filePath,
			file_size: fileSize,
			mime_type: mimeType
		});

	if (error) {
		console.error('Error logging storage usage:', error);
	}
}

/**
 * Get user session info
 */
export async function getUserSessions(userId: string) {
	const { data, error } = await supabase
		.from('user_sessions')
		.select('*')
		.eq('user_id', userId)
		.gt('expires_at', new Date().toISOString())
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Error fetching user sessions:', error);
		return [];
	}

	return data || [];
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions() {
	const { error } = await supabase
		.from('user_sessions')
		.delete()
		.lt('expires_at', new Date().toISOString());

	if (error) {
		console.error('Error cleaning up expired sessions:', error);
	}
}

/**
 * Get system health metrics
 */
export async function getSystemHealth() {
	const [
		totalUsers,
		totalChats,
		totalMessages,
		totalApiCalls,
		totalStorageSize
	] = await Promise.all([
		getTotalUsers(),
		getTotalChats(),
		getTotalMessages(),
		getTotalApiCalls(),
		getTotalStorageSize()
	]);

	return {
		totalUsers,
		totalChats,
		totalMessages,
		totalApiCalls,
		totalStorageSize,
		timestamp: new Date()
	};
}

async function getTotalUsers() {
	const { count, error } = await supabase
		.from('profiles')
		.select('*', { count: 'exact', head: true });

	if (error) {
		console.error('Error fetching total users:', error);
		return 0;
	}

	return count || 0;
}

async function getTotalChats() {
	const { count, error } = await supabase
		.from('chats')
		.select('*', { count: 'exact', head: true });

	if (error) {
		console.error('Error fetching total chats:', error);
		return 0;
	}

	return count || 0;
}

async function getTotalMessages() {
	const { count, error } = await supabase
		.from('messages')
		.select('*', { count: 'exact', head: true });

	if (error) {
		console.error('Error fetching total messages:', error);
		return 0;
	}

	return count || 0;
}

async function getTotalApiCalls() {
	const { count, error } = await supabase
		.from('api_usage')
		.select('*', { count: 'exact', head: true });

	if (error) {
		console.error('Error fetching total API calls:', error);
		return 0;
	}

	return count || 0;
}

async function getTotalStorageSize() {
	const { data, error } = await supabase
		.from('storage_usage')
		.select('file_size')
		.is('deleted_at', null);

	if (error) {
		console.error('Error fetching total storage size:', error);
		return 0;
	}

	return data?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;
}