import { uploadFile, downloadFile, STORAGE_BUCKETS } from './storage.js';
import { trackStorageUsage } from './analytics.js';
import { createCompletion, type ChatMessage } from './llm.js';
import { v4 as uuidv4 } from 'uuid';

interface PdfUploadResult {
	id: string;
	path: string;
	publicUrl: string;
	chunks?: string[];
}

interface PdfQARequest {
	pdfContent: string;
	question: string;
	model?: string;
	maxTokens?: number;
}

interface PdfQAResponse {
	answer: string;
	confidence?: number;
	sources?: string[];
}

/**
 * Upload a PDF file and prepare it for Q&A
 */
export async function uploadPdfForQA(
	file: File,
	userId: string,
	processImmediately: boolean = false
): Promise<PdfUploadResult> {
	// Validate file type
	if (file.type !== 'application/pdf') {
		throw new Error('File must be a PDF');
	}

	// Validate file size (max 10MB)
	const maxSize = 10 * 1024 * 1024;
	if (file.size > maxSize) {
		throw new Error('File size must be less than 10MB');
	}

	// Generate unique path
	const timestamp = Date.now();
	const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
	const path = `${userId}/pdfs/${timestamp}_${sanitizedName}`;

	// Upload to Supabase
	const uploadResult = await uploadFile(file, {
		bucket: STORAGE_BUCKETS.DOCUMENTS,
		path: userId + '/pdfs',
		contentType: 'application/pdf'
	});

	if (uploadResult.error || !uploadResult.data) {
		throw new Error(`Failed to upload PDF: ${uploadResult.error?.message}`);
	}

	// Track storage usage
	await trackStorageUsage({
		user_id: userId,
		bucket: STORAGE_BUCKETS.DOCUMENTS,
		file_path: uploadResult.data.path,
		file_size: file.size,
		mime_type: file.type
	});

	const result: PdfUploadResult = {
		id: uploadResult.data.id,
		path: uploadResult.data.path,
		publicUrl: uploadResult.data.publicUrl
	};

	// Process PDF if requested
	if (processImmediately) {
		try {
			const chunks = await processPdfToChunks(uploadResult.data.path);
			result.chunks = chunks;
		} catch (error) {
			console.error('Failed to process PDF immediately:', error);
			// Don't fail the upload if processing fails
		}
	}

	return result;
}

/**
 * Process PDF content into chunks for Q&A
 * Note: This is a simplified implementation. In production, you'd use
 * a proper PDF parsing library like pdf-parse or pdf.js
 */
export async function processPdfToChunks(
	pdfPath: string,
	chunkSize: number = 2000,
	overlap: number = 200
): Promise<string[]> {
	// Download the PDF from storage
	const { data: blob, error } = await downloadFile(STORAGE_BUCKETS.DOCUMENTS, pdfPath);

	if (error || !blob) {
		throw new Error(`Failed to download PDF: ${error?.message}`);
	}

	// Convert blob to text
	// NOTE: This is a placeholder. In production, you need a proper PDF parser
	// Install: npm install pdf-parse
	// Then use: const pdfParse = require('pdf-parse');
	// const data = await pdfParse(blob);
	// const text = data.text;
	
	// For now, we'll simulate text extraction
	const text = await blob.text();
	
	// If the text is too short, return as single chunk
	if (text.length <= chunkSize) {
		return [text];
	}

	// Split text into chunks with overlap
	const chunks: string[] = [];
	let start = 0;

	while (start < text.length) {
		const end = Math.min(start + chunkSize, text.length);
		const chunk = text.substring(start, end);
		
		// Find a good break point (end of sentence or paragraph)
		let breakPoint = end;
		if (end < text.length) {
			// Look for sentence end
			const sentenceEnd = chunk.lastIndexOf('. ');
			const paragraphEnd = chunk.lastIndexOf('\n\n');
			
			if (paragraphEnd > chunkSize * 0.8) {
				breakPoint = start + paragraphEnd + 2;
			} else if (sentenceEnd > chunkSize * 0.8) {
				breakPoint = start + sentenceEnd + 2;
			}
		}

		chunks.push(text.substring(start, breakPoint).trim());
		start = breakPoint - overlap;
	}

	return chunks;
}

/**
 * Answer a question about a PDF using OpenRouter
 */
export async function answerPdfQuestion({
	pdfContent,
	question,
	model = 'openai/gpt-3.5-turbo',
	maxTokens = 1000
}: PdfQARequest): Promise<PdfQAResponse> {
	// Prepare the system prompt
	const systemPrompt = `You are a helpful assistant that answers questions about documents. 
You will be provided with document content and a user question. 
Answer the question based ONLY on the information provided in the document. 
If the answer cannot be found in the document, say so clearly.
Be concise but thorough in your answers.`;

	// Prepare the user prompt
	const userPrompt = `Document Content:
${pdfContent}

Question: ${question}

Please answer the question based on the document content above.`;

	// Create messages for the LLM
	const messages: ChatMessage[] = [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: userPrompt }
	];

	// Get response from LLM
	const response = await createCompletion({
		messages,
		model,
		temperature: 0.3, // Lower temperature for more factual answers
		max_tokens: maxTokens
	});

	const answer = response.choices[0]?.message?.content || 'Unable to generate an answer.';

	return {
		answer,
		confidence: 0.8 // You could implement confidence scoring based on the response
	};
}

/**
 * Answer a question using multiple PDF chunks
 */
export async function answerWithContext(
	chunks: string[],
	question: string,
	model: string = 'openai/gpt-3.5-turbo'
): Promise<PdfQAResponse> {
	// Find the most relevant chunks (simplified - you could use embeddings here)
	const relevantChunks = findRelevantChunks(chunks, question, 3);

	// Combine relevant chunks
	const context = relevantChunks.join('\n\n---\n\n');

	// Answer the question with context
	return answerPdfQuestion({
		pdfContent: context,
		question,
		model
	});
}

/**
 * Find relevant chunks for a question (simplified keyword matching)
 * In production, you'd use embeddings for semantic search
 */
function findRelevantChunks(chunks: string[], question: string, maxChunks: number = 3): string[] {
	// Extract keywords from question (simplified)
	const keywords = question
		.toLowerCase()
		.split(/\W+/)
		.filter((word) => word.length > 3);

	// Score each chunk
	const scoredChunks = chunks.map((chunk) => {
		const chunkLower = chunk.toLowerCase();
		const score = keywords.reduce((acc, keyword) => {
			// Count occurrences of keyword in chunk
			const matches = (chunkLower.match(new RegExp(keyword, 'g')) || []).length;
			return acc + matches;
		}, 0);

		return { chunk, score };
	});

	// Sort by score and return top chunks
	return scoredChunks
		.sort((a, b) => b.score - a.score)
		.slice(0, maxChunks)
		.filter((item) => item.score > 0)
		.map((item) => item.chunk);
}

/**
 * Generate a summary of a PDF
 */
export async function summarizePdf(
	pdfContent: string,
	model: string = 'openai/gpt-3.5-turbo',
	maxLength: number = 500
): Promise<string> {
	const systemPrompt = `You are a helpful assistant that creates concise summaries of documents.
Create a summary that captures the main points and key information.
The summary should be no more than ${maxLength} words.`;

	const userPrompt = `Please summarize the following document:

${pdfContent}`;

	const messages: ChatMessage[] = [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: userPrompt }
	];

	const response = await createCompletion({
		messages,
		model,
		temperature: 0.5,
		max_tokens: Math.ceil(maxLength * 1.5) // Tokens are roughly 0.75 words
	});

	return response.choices[0]?.message?.content || 'Unable to generate summary.';
}

/**
 * Extract key information from a PDF
 */
export async function extractKeyInfo(
	pdfContent: string,
	infoTypes: string[],
	model: string = 'openai/gpt-3.5-turbo'
): Promise<Record<string, string>> {
	const systemPrompt = `You are a helpful assistant that extracts specific information from documents.
Extract the requested information and return it in a structured format.
If information is not found, indicate "Not found" for that field.`;

	const userPrompt = `From the following document, extract these pieces of information:
${infoTypes.map((type) => `- ${type}`).join('\n')}

Document:
${pdfContent}

Return the information in this format:
[Information Type]: [Extracted Value]`;

	const messages: ChatMessage[] = [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: userPrompt }
	];

	const response = await createCompletion({
		messages,
		model,
		temperature: 0.3,
		max_tokens: 1000
	});

	// Parse the response into a structured format
	const result: Record<string, string> = {};
	const lines = response.choices[0]?.message?.content?.split('\n') || [];

	for (const line of lines) {
		const match = line.match(/^(.+?):\s*(.+)$/);
		if (match) {
			const [, key, value] = match;
			result[key.trim()] = value.trim();
		}
	}

	return result;
}

/**
 * Compare two PDFs and highlight differences
 */
export async function comparePdfs(
	pdf1Content: string,
	pdf2Content: string,
	model: string = 'openai/gpt-3.5-turbo'
): Promise<{
	similarities: string[];
	differences: string[];
	summary: string;
}> {
	const systemPrompt = `You are a helpful assistant that compares documents.
Identify the key similarities and differences between two documents.
Be specific and provide concrete examples.`;

	const userPrompt = `Compare these two documents:

Document 1:
${pdf1Content.substring(0, 3000)} // Limit for token management

Document 2:
${pdf2Content.substring(0, 3000)} // Limit for token management

Please provide:
1. Key similarities
2. Key differences
3. A brief summary of the comparison`;

	const messages: ChatMessage[] = [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: userPrompt }
	];

	const response = await createCompletion({
		messages,
		model,
		temperature: 0.5,
		max_tokens: 1500
	});

	// Parse the response (simplified)
	const content = response.choices[0]?.message?.content || '';
	
	// This is a simplified parsing - you might want to use a more robust approach
	const sections = content.split(/\d+\.\s+/);
	
	return {
		similarities: sections[1]?.split('\n').filter(Boolean) || [],
		differences: sections[2]?.split('\n').filter(Boolean) || [],
		summary: sections[3] || 'Unable to generate comparison summary.'
	};
}

export {
	type PdfUploadResult,
	type PdfQARequest,
	type PdfQAResponse
};

