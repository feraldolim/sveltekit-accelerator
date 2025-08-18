import { describe, it, expect, vi, beforeEach } from 'vitest';
import { estimateTokenCount, truncateMessages, generateText } from './llm.js';
import type { ChatMessage } from './llm.js';

// Mock environment variables
vi.mock('$env/static/private', () => ({
	OPENROUTER_API_KEY: 'test-api-key',
	OPENROUTER_DEFAULT_MODEL: 'openai/gpt-3.5-turbo'
}));

// Mock fetch for API calls
global.fetch = vi.fn();

describe('LLM Utilities', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('estimateTokenCount', () => {
		it('should estimate token count correctly', () => {
			expect(estimateTokenCount('Hello world')).toBe(3); // 11 chars / 4 ≈ 3
			expect(estimateTokenCount('')).toBe(0);
			expect(estimateTokenCount('A'.repeat(100))).toBe(25); // 100 chars / 4 = 25
		});
	});

	describe('truncateMessages', () => {
		const messages: ChatMessage[] = [
			{ role: 'system', content: 'You are a helpful assistant.' },
			{ role: 'user', content: 'Hello' },
			{ role: 'assistant', content: 'Hi there!' },
			{ role: 'user', content: 'How are you?' },
			{ role: 'assistant', content: 'I am doing well, thank you!' }
		];

		it('should preserve system message', () => {
			const result = truncateMessages(messages, 1000); // Use higher limit to ensure all messages are included
			expect(result[0].role).toBe('system');
			expect(result[0].content).toBe('You are a helpful assistant.');
		});

		it('should truncate messages when exceeding token limit', () => {
			const result = truncateMessages(messages, 10); // Very small limit
			expect(result.length).toBeLessThan(messages.length);
			expect(result[0].role).toBe('system'); // System message preserved
		});

		it('should return all messages when under token limit', () => {
			const result = truncateMessages(messages, 1000);
			expect(result.length).toBe(messages.length);
		});

		it('should handle messages without system prompt', () => {
			const messagesWithoutSystem = messages.slice(1);
			const result = truncateMessages(messagesWithoutSystem, 100);
			expect(result[0].role).not.toBe('system');
		});
	});

	describe('generateText', () => {
		it('should generate text successfully', async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: 'Hello! How can I help you today?'
							}
						}
					],
					usage: {
						total_tokens: 20
					}
				})
			};

			vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

			const result = await generateText('Hello', 'You are helpful');
			expect(result).toBe('Hello! How can I help you today?');
		});

		it('should handle API errors', async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				text: async () => 'API Error'
			};

			vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

			await expect(generateText('Hello')).rejects.toThrow('OpenRouter API error');
		});

		it('should handle empty response', async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({
					choices: []
				})
			};

			vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

			const result = await generateText('Hello');
			expect(result).toBe('');
		});
	});
});
