import { supabaseAdmin } from './supabase.js';
import { createCompletion, type ChatMessage } from './llm.js';

export interface FileUpload {
	id: string;
	user_id: string;
	original_name: string;
	file_path: string;
	mime_type: string;
	file_size: number;
	file_type: 'pdf' | 'image' | 'audio';
	processed_data?: any;
	processing_status: 'pending' | 'processing' | 'completed' | 'failed';
	processing_error?: string;
	is_public: boolean;
	created_at: string;
	updated_at: string;
}

export interface ProcessingOptions {
	extract_text?: boolean;
	extract_metadata?: boolean;
	analyze_content?: boolean;
	custom_prompt?: string;
	model?: string;
	language?: string; // For audio transcription
	format?: string; // Output format
}

export interface ProcessingResult {
	success: boolean;
	data?: any;
	error?: string;
	metadata?: any;
}

/**
 * Save file upload record to database
 */
export async function createFileUpload(
	userId: string,
	file: File,
	filePath: string,
	fileType: 'pdf' | 'image' | 'audio'
): Promise<FileUpload> {
	const uploadData = {
		user_id: userId,
		original_name: file.name,
		file_path: filePath,
		mime_type: file.type,
		file_size: file.size,
		file_type: fileType,
		processing_status: 'pending' as const,
		is_public: false
	};

	const { data, error } = await supabaseAdmin
		.from('file_uploads')
		.insert([uploadData])
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to create file upload record: ${error.message}`);
	}

	return data;
}

/**
 * Get file upload by ID
 */
export async function getFileUpload(
	userId: string,
	fileId: string,
	allowPublic: boolean = true
): Promise<FileUpload | null> {
	let query = supabaseAdmin
		.from('file_uploads')
		.select('*')
		.eq('id', fileId);

	if (allowPublic) {
		query = query.or(`user_id.eq.${userId},is_public.eq.true`);
	} else {
		query = query.eq('user_id', userId);
	}

	const { data, error } = await query.single();

	if (error) {
		if (error.code === 'PGRST116') return null; // Not found
		throw new Error(`Failed to get file upload: ${error.message}`);
	}

	return data;
}

/**
 * List file uploads for a user
 */
export async function listFileUploads(
	userId: string,
	options?: {
		file_type?: 'pdf' | 'image' | 'audio';
		processing_status?: string;
		include_public?: boolean;
		search?: string;
		limit?: number;
		offset?: number;
	}
): Promise<FileUpload[]> {
	let query = supabaseAdmin
		.from('file_uploads')
		.select('*');

	// Filter by ownership or public
	if (options?.include_public !== false) {
		query = query.or(`user_id.eq.${userId},is_public.eq.true`);
	} else {
		query = query.eq('user_id', userId);
	}

	// Filter by file type
	if (options?.file_type) {
		query = query.eq('file_type', options.file_type);
	}

	// Filter by processing status
	if (options?.processing_status) {
		query = query.eq('processing_status', options.processing_status);
	}

	// Search in filename
	if (options?.search) {
		query = query.ilike('original_name', `%${options.search}%`);
	}

	// Pagination
	if (options?.limit) {
		query = query.limit(options.limit);
	}
	if (options?.offset) {
		query = query.range(options.offset, (options.offset + (options.limit || 10)) - 1);
	}

	query = query.order('created_at', { ascending: false });

	const { data, error } = await query;

	if (error) {
		throw new Error(`Failed to list file uploads: ${error.message}`);
	}

	return data || [];
}

/**
 * Update file processing status and data
 */
export async function updateFileProcessing(
	fileId: string,
	updates: {
		processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
		processed_data?: any;
		processing_error?: string;
	}
): Promise<void> {
	const { error } = await supabaseAdmin
		.from('file_uploads')
		.update({
			...updates,
			updated_at: new Date().toISOString()
		})
		.eq('id', fileId);

	if (error) {
		throw new Error(`Failed to update file processing: ${error.message}`);
	}
}

/**
 * Delete file upload
 */
export async function deleteFileUpload(userId: string, fileId: string): Promise<boolean> {
	const { error } = await supabaseAdmin
		.from('file_uploads')
		.delete()
		.eq('id', fileId)
		.eq('user_id', userId);

	if (error) {
		throw new Error(`Failed to delete file upload: ${error.message}`);
	}

	return true;
}

/**
 * Process PDF file - extract text
 */
export async function processPDF(
	fileId: string,
	fileBuffer: Buffer,
	options: ProcessingOptions = {}
): Promise<ProcessingResult> {
	try {
		await updateFileProcessing(fileId, { processing_status: 'processing' });

		// In a real implementation, you would use a PDF processing library
		// For now, we'll simulate the processing
		const mockResult = {
			text: 'Extracted text from PDF would go here...',
			pages: 5,
			word_count: 1250,
			metadata: {
				title: 'Document Title',
				author: 'Document Author',
				creation_date: new Date().toISOString()
			}
		};

		// If custom analysis is requested, use AI to analyze the content
		let analysis;
		if (options.analyze_content && options.custom_prompt) {
			try {
				const messages: ChatMessage[] = [
					{
						role: 'system',
						content: 'You are a document analysis expert. Analyze the provided text and respond according to the user\'s request.'
					},
					{
						role: 'user',
						content: `${options.custom_prompt}\n\nDocument text:\n${mockResult.text}`
					}
				];

				const completion = await createCompletion({
					messages,
					model: options.model || 'openai/gpt-3.5-turbo',
					temperature: 0.3
				});

				analysis = completion.choices[0]?.message?.content;
			} catch (error) {
				console.warn('Failed to analyze PDF content:', error);
			}
		}

		const processedData = {
			...mockResult,
			analysis,
			format: options.format || 'text',
			processing_options: options
		};

		await updateFileProcessing(fileId, {
			processing_status: 'completed',
			processed_data: processedData
		});

		return { success: true, data: processedData };

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		await updateFileProcessing(fileId, {
			processing_status: 'failed',
			processing_error: errorMessage
		});

		return { success: false, error: errorMessage };
	}
}

/**
 * Process image file - analyze with vision models
 */
export async function processImage(
	fileId: string,
	fileBuffer: Buffer,
	options: ProcessingOptions = {}
): Promise<ProcessingResult> {
	try {
		await updateFileProcessing(fileId, { processing_status: 'processing' });

		// Convert image to base64 for vision models
		const base64Image = `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;

		let analysis = 'Image processed successfully';
		
		// Use vision model to analyze if requested
		if (options.analyze_content) {
			try {
				const prompt = options.custom_prompt || 'Describe what you see in this image in detail.';
				
				const messages: ChatMessage[] = [
					{
						role: 'user',
						content: prompt
					}
				];

				// Add image content (this would need to be adapted for the specific API format)
				const completion = await createCompletion({
					messages,
					model: options.model || 'openai/gpt-4-vision-preview',
					temperature: 0.3,
					max_tokens: 1000
				});

				analysis = completion.choices[0]?.message?.content || 'No analysis available';
			} catch (error) {
				console.warn('Failed to analyze image:', error);
				analysis = 'Image uploaded but analysis failed';
			}
		}

		const processedData = {
			description: analysis,
			base64_url: base64Image,
			size: fileBuffer.length,
			format: options.format || 'description',
			processing_options: options,
			metadata: {
				analyzed_at: new Date().toISOString(),
				model_used: options.model || 'openai/gpt-4-vision-preview'
			}
		};

		await updateFileProcessing(fileId, {
			processing_status: 'completed',
			processed_data: processedData
		});

		return { success: true, data: processedData };

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		await updateFileProcessing(fileId, {
			processing_status: 'failed',
			processing_error: errorMessage
		});

		return { success: false, error: errorMessage };
	}
}

/**
 * Process audio file - transcription
 */
export async function processAudio(
	fileId: string,
	fileBuffer: Buffer,
	options: ProcessingOptions = {}
): Promise<ProcessingResult> {
	try {
		await updateFileProcessing(fileId, { processing_status: 'processing' });

		// In a real implementation, you would use audio processing libraries
		// and potentially send to transcription services like OpenAI Whisper
		const mockResult = {
			transcript: 'Mock transcription of the audio file would go here...',
			duration: 120.5,
			language: options.language || 'en',
			confidence: 0.95,
			speaker_count: 1,
			timestamps: [
				{ start: 0, end: 10, text: 'First segment of speech...' },
				{ start: 10, end: 20, text: 'Second segment of speech...' }
			]
		};

		// If custom analysis is requested, use AI to analyze the transcript
		let analysis;
		if (options.analyze_content && options.custom_prompt) {
			try {
				const messages: ChatMessage[] = [
					{
						role: 'system',
						content: 'You are an audio content analysis expert. Analyze the provided transcript and respond according to the user\'s request.'
					},
					{
						role: 'user',
						content: `${options.custom_prompt}\n\nTranscript:\n${mockResult.transcript}`
					}
				];

				const completion = await createCompletion({
					messages,
					model: options.model || 'openai/gpt-3.5-turbo',
					temperature: 0.3
				});

				analysis = completion.choices[0]?.message?.content;
			} catch (error) {
				console.warn('Failed to analyze audio content:', error);
			}
		}

		const processedData = {
			...mockResult,
			analysis,
			format: options.format || 'transcript',
			processing_options: options
		};

		await updateFileProcessing(fileId, {
			processing_status: 'completed',
			processed_data: processedData
		});

		return { success: true, data: processedData };

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		await updateFileProcessing(fileId, {
			processing_status: 'failed',
			processing_error: errorMessage
		});

		return { success: false, error: errorMessage };
	}
}

/**
 * Main file processing function
 */
export async function processFile(
	fileId: string,
	options: ProcessingOptions = {}
): Promise<ProcessingResult> {
	// Get file info from database
	const { data: fileInfo, error } = await supabaseAdmin
		.from('file_uploads')
		.select('*')
		.eq('id', fileId)
		.single();

	if (error) {
		return { success: false, error: `File not found: ${error.message}` };
	}

	// In a real implementation, you would fetch the file from storage
	// For now, we'll create a mock buffer
	const mockBuffer = Buffer.from('mock file content');

	switch (fileInfo.file_type) {
		case 'pdf':
			return processPDF(fileId, mockBuffer, options);
		case 'image':
			return processImage(fileId, mockBuffer, options);
		case 'audio':
			return processAudio(fileId, mockBuffer, options);
		default:
			return { success: false, error: `Unsupported file type: ${fileInfo.file_type}` };
	}
}

/**
 * Batch process multiple files
 */
export async function batchProcessFiles(
	fileIds: string[],
	options: ProcessingOptions = {}
): Promise<Array<{ fileId: string; result: ProcessingResult }>> {
	const results: Array<{ fileId: string; result: ProcessingResult }> = [];

	// Process files sequentially to avoid overwhelming the system
	for (const fileId of fileIds) {
		try {
			const result = await processFile(fileId, options);
			results.push({ fileId, result });
		} catch (error) {
			results.push({
				fileId,
				result: {
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				}
			});
		}
	}

	return results;
}

/**
 * Get file processing statistics
 */
export async function getProcessingStats(userId: string): Promise<{
	total_files: number;
	by_type: Record<string, number>;
	by_status: Record<string, number>;
	total_size: number;
	processing_queue_size: number;
}> {
	const { data: files, error } = await supabaseAdmin
		.from('file_uploads')
		.select('file_type, processing_status, file_size')
		.eq('user_id', userId);

	if (error) {
		throw new Error(`Failed to get processing stats: ${error.message}`);
	}

	const stats = {
		total_files: files?.length || 0,
		by_type: {} as Record<string, number>,
		by_status: {} as Record<string, number>,
		total_size: 0,
		processing_queue_size: 0
	};

	for (const file of files || []) {
		// Count by type
		stats.by_type[file.file_type] = (stats.by_type[file.file_type] || 0) + 1;
		
		// Count by status
		stats.by_status[file.processing_status] = (stats.by_status[file.processing_status] || 0) + 1;
		
		// Total size
		stats.total_size += file.file_size;
		
		// Queue size
		if (['pending', 'processing'].includes(file.processing_status)) {
			stats.processing_queue_size += 1;
		}
	}

	return stats;
}

/**
 * Supported file types and their configurations
 */
export const SUPPORTED_FILE_TYPES = {
	pdf: {
		mime_types: ['application/pdf'],
		max_size: 50 * 1024 * 1024, // 50MB
		processing_features: ['text_extraction', 'metadata_extraction', 'content_analysis']
	},
	image: {
		mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
		max_size: 10 * 1024 * 1024, // 10MB
		processing_features: ['vision_analysis', 'content_description', 'object_detection']
	},
	audio: {
		mime_types: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm'],
		max_size: 100 * 1024 * 1024, // 100MB
		processing_features: ['transcription', 'speaker_diarization', 'content_analysis']
	}
};

/**
 * Validate file before upload
 */
export function validateFile(file: File): { valid: boolean; error?: string; file_type?: string } {
	// Check file size
	let fileType: string | undefined;
	let maxSize = 0;

	for (const [type, config] of Object.entries(SUPPORTED_FILE_TYPES)) {
		if (config.mime_types.includes(file.type)) {
			fileType = type;
			maxSize = config.max_size;
			break;
		}
	}

	if (!fileType) {
		return {
			valid: false,
			error: `Unsupported file type: ${file.type}. Supported types: ${Object.values(SUPPORTED_FILE_TYPES).flatMap(c => c.mime_types).join(', ')}`
		};
	}

	if (file.size > maxSize) {
		return {
			valid: false,
			error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size for ${fileType}: ${(maxSize / 1024 / 1024).toFixed(0)}MB`
		};
	}

	return { valid: true, file_type: fileType };
}