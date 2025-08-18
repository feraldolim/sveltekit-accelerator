import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processPdfToChunks, answerPdfQuestion, summarizePdf } from './pdf-processor.js';

// Mock dependencies
vi.mock('./storage.js', () => ({
	uploadFile: vi.fn(),
	downloadFile: vi.fn(),
	STORAGE_BUCKETS: {
		DOCUMENTS: 'documents'
	}
}));

vi.mock('./analytics.js', () => ({
	trackStorageUsage: vi.fn()
}));

vi.mock('./llm.js', () => ({
	createCompletion: vi.fn()
}));

describe('PDF Processor', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('processPdfToChunks', () => {
		it('should process text into chunks correctly', async () => {
			const { downloadFile } = await import('./storage.js');
			const mockBlob = {
				text: async () => 'A'.repeat(5000) // 5000 characters
			};
			
			vi.mocked(downloadFile).mockResolvedValue({
				data: mockBlob,
				error: null
			} as any);

			const chunks = await processPdfToChunks('test-path.pdf');
			
			expect(chunks).toBeInstanceOf(Array);
			expect(chunks.length).toBeGreaterThan(1); // Should be chunked
			expect(chunks[0].length).toBeLessThanOrEqual(2000); // Default chunk size
		});

		it('should return single chunk for small text', async () => {
			const { downloadFile } = await import('./storage.js');
			const mockBlob = {
				text: async () => 'Short text content'
			};
			
			vi.mocked(downloadFile).mockResolvedValue({
				data: mockBlob,
				error: null
			} as any);

			const chunks = await processPdfToChunks('test-path.pdf');
			
			expect(chunks).toHaveLength(1);
			expect(chunks[0]).toBe('Short text content');
		});

		it('should handle download errors', async () => {
			const { downloadFile } = await import('./storage.js');
			
			vi.mocked(downloadFile).mockResolvedValue({
				data: null,
				error: new Error('Download failed')
			} as any);

			await expect(processPdfToChunks('test-path.pdf')).rejects.toThrow('Failed to download PDF');
		});
	});

	describe('answerPdfQuestion', () => {
		it('should answer question about PDF content', async () => {
			const { createCompletion } = await import('./llm.js');
			
			vi.mocked(createCompletion).mockResolvedValue({
				choices: [
					{
						message: {
							content: 'The document discusses artificial intelligence and its applications.'
						}
					}
				]
			} as any);

			const result = await answerPdfQuestion({
				pdfContent: 'This document is about artificial intelligence and machine learning.',
				question: 'What is this document about?'
			});

			expect(result.answer).toContain('artificial intelligence');
			expect(result.confidence).toBeDefined();
		});

		it('should handle LLM errors', async () => {
			const { createCompletion } = await import('./llm.js');
			
			vi.mocked(createCompletion).mockRejectedValue(new Error('LLM API error'));

			await expect(answerPdfQuestion({
				pdfContent: 'Test content',
				question: 'What is this about?'
			})).rejects.toThrow('LLM API error');
		});

		it('should handle empty response from LLM', async () => {
			const { createCompletion } = await import('./llm.js');
			
			vi.mocked(createCompletion).mockResolvedValue({
				choices: []
			} as any);

			const result = await answerPdfQuestion({
				pdfContent: 'Test content',
				question: 'What is this about?'
			});

			expect(result.answer).toBe('Unable to generate an answer.');
		});
	});

	describe('summarizePdf', () => {
		it('should generate summary of PDF content', async () => {
			const { createCompletion } = await import('./llm.js');
			
			vi.mocked(createCompletion).mockResolvedValue({
				choices: [
					{
						message: {
							content: 'This document provides a comprehensive overview of machine learning techniques and their practical applications in modern technology.'
						}
					}
				]
			} as any);

			const summary = await summarizePdf('Long document about machine learning...');

			expect(summary).toContain('machine learning');
			expect(summary.length).toBeGreaterThan(0);
		});

		it('should respect max length parameter', async () => {
			const { createCompletion } = await import('./llm.js');
			
			// Mock the createCompletion call to check parameters
			const mockCreateCompletion = vi.mocked(createCompletion);
			mockCreateCompletion.mockResolvedValue({
				choices: [
					{
						message: {
							content: 'Short summary.'
						}
					}
				]
			} as any);

			await summarizePdf('Test content', 'openai/gpt-3.5-turbo', 100);

			// Check that max_tokens was set appropriately (100 words * 1.5 = 150 tokens)
			expect(mockCreateCompletion).toHaveBeenCalledWith(
				expect.objectContaining({
					max_tokens: 150
				})
			);
		});
	});
});

