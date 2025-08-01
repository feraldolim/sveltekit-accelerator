import { OPENROUTER_API_KEY, OPENROUTER_DEFAULT_MODEL } from '$env/static/private';

if (!OPENROUTER_API_KEY) {
	throw new Error('OPENROUTER_API_KEY is required');
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = OPENROUTER_DEFAULT_MODEL || 'openai/gpt-3.5-turbo';

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface CompletionRequest {
	messages: ChatMessage[];
	model?: string;
	temperature?: number;
	max_tokens?: number;
	top_p?: number;
	frequency_penalty?: number;
	presence_penalty?: number;
	stream?: boolean;
}

export interface CompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		message: ChatMessage;
		finish_reason: string;
	}[];
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

export interface StreamChunk {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: {
		index: number;
		delta: {
			role?: string;
			content?: string;
		};
		finish_reason: string | null;
	}[];
}

/**
 * Create a completion using OpenRouter API
 */
export async function createCompletion(request: CompletionRequest): Promise<CompletionResponse> {
	const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': process.env.PUBLIC_APP_URL || 'http://localhost:5173',
			'X-Title': 'SvelteKit Accelerator'
		},
		body: JSON.stringify({
			...request,
			model: request.model || DEFAULT_MODEL,
			stream: false
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`OpenRouter API error: ${response.status} ${error}`);
	}

	return await response.json();
}

/**
 * Create a streaming completion using OpenRouter API
 */
export async function createCompletionStream(request: CompletionRequest): Promise<ReadableStream> {
	const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': process.env.PUBLIC_APP_URL || 'http://localhost:5173',
			'X-Title': 'SvelteKit Accelerator'
		},
		body: JSON.stringify({
			...request,
			model: request.model || DEFAULT_MODEL,
			stream: true
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`OpenRouter API error: ${response.status} ${error}`);
	}

	if (!response.body) {
		throw new Error('No response body received');
	}

	return response.body;
}

/**
 * Parse SSE (Server-Sent Events) stream from OpenRouter
 */
export async function* parseStreamResponse(stream: ReadableStream): AsyncGenerator<StreamChunk> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();

			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				const trimmed = line.trim();

				if (trimmed === '') continue;
				if (trimmed === 'data: [DONE]') return;
				if (!trimmed.startsWith('data: ')) continue;

				try {
					const data = JSON.parse(trimmed.slice(6));
					yield data as StreamChunk;
				} catch (e) {
					console.warn('Failed to parse SSE data:', trimmed, e);
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}

/**
 * Simple completion helper that returns just the text content
 */
export async function generateText(
	prompt: string,
	systemPrompt?: string,
	model?: string
): Promise<string> {
	const messages: ChatMessage[] = [];

	if (systemPrompt) {
		messages.push({ role: 'system', content: systemPrompt });
	}

	messages.push({ role: 'user', content: prompt });

	const response = await createCompletion({
		messages,
		model: model || DEFAULT_MODEL,
		temperature: 0.7
	});

	return response.choices[0]?.message?.content || '';
}

/**
 * Chat completion with conversation history
 */
export async function createChatCompletion(
	messages: ChatMessage[],
	options?: {
		model?: string;
		temperature?: number;
		maxTokens?: number;
	}
): Promise<string> {
	const response = await createCompletion({
		messages,
		model: options?.model || DEFAULT_MODEL,
		temperature: options?.temperature || 0.7,
		max_tokens: options?.maxTokens
	});

	return response.choices[0]?.message?.content || '';
}

/**
 * Get available models from OpenRouter
 */
export async function getAvailableModels(): Promise<unknown[]> {
	const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
		headers: {
			Authorization: `Bearer ${OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch models: ${response.status}`);
	}

	const data = await response.json();
	return data.data || [];
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokenCount(text: string): number {
	// Rough approximation: 1 token ≈ 4 characters for English text
	return Math.ceil(text.length / 4);
}

/**
 * Truncate messages to fit within token limit
 */
export function truncateMessages(messages: ChatMessage[], maxTokens: number = 4000): ChatMessage[] {
	let totalTokens = 0;
	const truncated: ChatMessage[] = [];

	// Always include system message if present
	if (messages[0]?.role === 'system') {
		truncated.push(messages[0]);
		totalTokens += estimateTokenCount(messages[0].content);
	}

	// Add messages from the end (most recent first)
	for (let i = messages.length - 1; i >= (messages[0]?.role === 'system' ? 1 : 0); i--) {
		const message = messages[i];
		const tokens = estimateTokenCount(message.content);

		if (totalTokens + tokens > maxTokens) {
			break;
		}

		truncated.unshift(message);
		totalTokens += tokens;
	}

	return truncated;
}
