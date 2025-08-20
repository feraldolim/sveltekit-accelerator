export type Database = {
	public: {
		Tables: {
			chats: {
				Row: {
					id: string;
					user_id: string;
					title: string;
					model: string;
					default_system_prompt_id: string | null;
					default_structured_output_id: string | null;
					message_count: number;
					is_pinned: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					title?: string;
					model?: string;
					default_system_prompt_id?: string | null;
					default_structured_output_id?: string | null;
					message_count?: number;
					is_pinned?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					title?: string;
					model?: string;
					default_system_prompt_id?: string | null;
					default_structured_output_id?: string | null;
					message_count?: number;
					is_pinned?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			messages: {
				Row: {
					id: string;
					chat_id: string;
					role: 'user' | 'assistant' | 'system';
					content: string;
					model: string | null;
					system_prompt_id: string | null;
					system_prompt_version: number | null;
					structured_output_id: string | null;
					structured_output_version: number | null;
					token_count: number | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					chat_id: string;
					role: 'user' | 'assistant' | 'system';
					content: string;
					model?: string | null;
					system_prompt_id?: string | null;
					system_prompt_version?: number | null;
					structured_output_id?: string | null;
					structured_output_version?: number | null;
					token_count?: number | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					chat_id?: string;
					role?: 'user' | 'assistant' | 'system';
					content?: string;
					model?: string | null;
					system_prompt_id?: string | null;
					system_prompt_version?: number | null;
					structured_output_id?: string | null;
					structured_output_version?: number | null;
					token_count?: number | null;
					created_at?: string;
				};
			};
			user_favorite_models: {
				Row: {
					id: string;
					user_id: string;
					model_id: string;
					display_name: string | null;
					is_default: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					model_id: string;
					display_name?: string | null;
					is_default?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					model_id?: string;
					display_name?: string | null;
					is_default?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			file_uploads: {
				Row: {
					id: string;
					user_id: string;
					original_name: string;
					file_path: string;
					mime_type: string;
					file_size: number;
					file_type: string;
					processed_data: any | null;
					processing_status: string;
					processing_error: string | null;
					is_public: boolean;
					chat_id: string | null;
					message_id: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					original_name: string;
					file_path: string;
					mime_type: string;
					file_size: number;
					file_type: string;
					processed_data?: any | null;
					processing_status?: string;
					processing_error?: string | null;
					is_public?: boolean;
					chat_id?: string | null;
					message_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					original_name?: string;
					file_path?: string;
					mime_type?: string;
					file_size?: number;
					file_type?: string;
					processed_data?: any | null;
					processing_status?: string;
					processing_error?: string | null;
					is_public?: boolean;
					chat_id?: string | null;
					message_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
		};
	};
};