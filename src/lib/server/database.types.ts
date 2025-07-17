export type Database = {
	public: {
		Tables: {
			chats: {
				Row: {
					id: string;
					user_id: string;
					title: string;
					model: string;
					system_prompt: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					title?: string;
					model?: string;
					system_prompt?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					title?: string;
					model?: string;
					system_prompt?: string | null;
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
					token_count: number | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					chat_id: string;
					role: 'user' | 'assistant' | 'system';
					content: string;
					model?: string | null;
					token_count?: number | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					chat_id?: string;
					role?: 'user' | 'assistant' | 'system';
					content?: string;
					model?: string | null;
					token_count?: number | null;
					created_at?: string;
				};
			};
		};
	};
};