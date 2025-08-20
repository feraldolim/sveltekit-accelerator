import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createCompletion,
	createCompletionStream,
	parseStreamResponse,
	truncateMessages,
	estimateTokenCount,
	type ChatMessage
} from '$lib/server/llm.js';
import { addMessage, createChat, updateChatTitle, updateChatMessageCount } from '$lib/server/chats.js';
import { createApiTracker, trackUserActivity } from '$lib/server/analytics.js';
import { getSystemPrompt } from '$lib/server/system-prompts.js';
import { getStructuredOutput } from '$lib/server/structured-outputs.js';
import { recordChatFiles, type FileAttachment } from '$lib/server/chat-files.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	const startTime = Date.now();
	const tracker = createApiTracker({ request, locals } as any, startTime);
	
	try {
		// Require authentication
		if (!locals.session || !locals.user) {
			error(401, 'Authentication required');
		}

		// Get user-provided API key from headers
		const userApiKey = request.headers.get('x-openrouter-api-key');

		const { 
			messages, 
			model, 
			stream = false, 
			temperature = 0.7, 
			max_tokens,
			max_completion_tokens,
			top_p,
			frequency_penalty,
			presence_penalty,
			chat_id,
			system_prompt,
			system_prompt_id,
			structured_output_id,
			response_format,
			attachments = []
		} = await request.json();

		// Validate input
		if (!messages || !Array.isArray(messages)) {
			error(400, 'Messages array is required');
		}

		if (messages.length === 0) {
			error(400, 'At least one message is required');
		}

		// Validate message format
		for (const message of messages) {
			if (!message.role || !message.content) {
				error(400, 'Each message must have role and content');
			}
			if (!['system', 'user', 'assistant'].includes(message.role)) {
				error(400, 'Invalid message role');
			}
		}

		// Process system prompt if ID is provided
		let resolvedSystemPrompt = system_prompt;
		let systemPromptData = null;
		if (system_prompt_id) {
			try {
				systemPromptData = await getSystemPrompt(locals.user.id, system_prompt_id, true);
				if (systemPromptData) {
					resolvedSystemPrompt = systemPromptData.content;
				}
			} catch (err) {
				console.warn('Failed to fetch system prompt:', err);
			}
		}

		// Process structured output if ID is provided
		let resolvedResponseFormat = response_format;
		let structuredOutputData = null;
		if (structured_output_id) {
			try {
				structuredOutputData = await getStructuredOutput(locals.user.id, structured_output_id, true);
				if (structuredOutputData) {
					resolvedResponseFormat = {
						type: 'json_schema',
						json_schema: {
							name: structuredOutputData.name,
							strict: true,
							schema: structuredOutputData.json_schema
						}
					};
				}
			} catch (err) {
				console.warn('Failed to fetch structured output schema:', err);
			}
		}

		// Process attachments into multimodal content
		let processedMessages = [...messages];
		if (attachments && attachments.length > 0) {
			// Find the last user message and convert it to multimodal format
			const lastUserIndex = processedMessages.length - 1;
			const lastMessage = processedMessages[lastUserIndex];
			
			if (lastMessage && lastMessage.role === 'user' && typeof lastMessage.content === 'string') {
				const contentArray: Array<{
					type: 'text' | 'image_url' | 'file';
					text?: string;
					image_url?: { url: string; detail?: 'low' | 'high' | 'auto' };
					file?: { filename: string; file_data: string };
				}> = [
					{ type: 'text', text: lastMessage.content }
				];

				// Add each attachment
				for (const attachment of attachments) {
					if (attachment.type === 'image' && attachment.data) {
						contentArray.push({
							type: 'image_url',
							image_url: {
								url: attachment.data, // Base64 data URI
								detail: 'high'
							}
						});
					} else if (attachment.type === 'pdf' && attachment.data) {
						// For PDFs, use the file type format
						contentArray.push({
							type: 'file',
							file: {
								filename: attachment.name,
								file_data: attachment.data // Base64 data URI for PDF
							}
						});
					} else if (attachment.type === 'audio' && attachment.data) {
						// For audio files, use the input_audio type format per OpenRouter docs
						// Extract format from filename or assume common formats
						const audioFormat = attachment.name.toLowerCase().includes('.wav') ? 'wav' : 'mp3';
						
						// Remove data URI prefix if present (data:audio/wav;base64,)
						const base64Data = attachment.data.includes(',') 
							? attachment.data.split(',')[1] 
							: attachment.data;
						
						contentArray.push({
							type: 'input_audio',
							input_audio: {
								data: base64Data, // Raw base64 data (no data URI prefix)
								format: audioFormat
							}
						});
					}
				}

				processedMessages[lastUserIndex] = {
					...lastMessage,
					content: contentArray
				};
			}
		}

		// Create or use existing chat
		let currentChatId = chat_id;
		let isFirstMessage = false;
		
		if (!currentChatId) {
			// Create a new chat
			const newChat = await createChat(
				locals.user.id,
				'New Chat',
				model || 'moonshotai/kimi-k2:free',
				system_prompt_id,
				structured_output_id
			);
			currentChatId = newChat.id;
			isFirstMessage = true;
		}

		// Get the last user message to save to database
		const lastUserMessage = messages[messages.length - 1];
		if (lastUserMessage && lastUserMessage.role === 'user') {
			// Extract text content for database storage
			const textContent = typeof lastUserMessage.content === 'string' 
				? lastUserMessage.content 
				: Array.isArray(lastUserMessage.content)
					? lastUserMessage.content.find(c => c.type === 'text')?.text || ''
					: '';

			const userMessage = await addMessage(
				currentChatId,
				'user',
				textContent,
				model || 'moonshotai/kimi-k2:free',
				undefined, // tokenCount - not available for user messages
				systemPromptData?.id,
				systemPromptData?.version,
				structuredOutputData?.id,
				structuredOutputData?.version
			);

			// Record file attachments if any
			if (attachments && attachments.length > 0) {
				console.log('Processing attachments:', attachments);
				
				const fileAttachments: FileAttachment[] = attachments
					.filter(att => att.type && att.name && att.data && ['pdf', 'image', 'audio'].includes(att.type))
					.map(att => {
						// Calculate file size from base64 data if not provided
						let fileSize = att.size || 0;
						if (!fileSize && att.data) {
							// Rough base64 to bytes conversion: (base64 length * 3 / 4) - padding
							const base64Data = att.data.includes(',') ? att.data.split(',')[1] : att.data;
							fileSize = Math.floor((base64Data.length * 3) / 4);
						}
						
						return {
							filename: att.name,
							file_type: att.type as 'pdf' | 'image' | 'audio',
							file_size: fileSize,
							mime_type: att.type === 'pdf' ? 'application/pdf' 
								: att.type === 'image' ? 'image/*'
								: att.type === 'audio' ? 'audio/*' 
								: 'application/octet-stream'
						};
					});
				
				console.log('Filtered file attachments:', fileAttachments);
				
				if (fileAttachments.length > 0) {
					console.log('Recording chat files:', {
						userId: locals.user.id,
						chatId: currentChatId,
						messageId: userMessage.id,
						fileCount: fileAttachments.length
					});
					
					try {
						const result = await recordChatFiles(locals.user.id, currentChatId, userMessage.id, fileAttachments);
						console.log('Successfully recorded chat files:', result);
					} catch (error) {
						console.error('Failed to record chat files:', error);
						// Don't throw here - we don't want to break the chat if file recording fails
					}
				}
			}

			// Update chat title if this is the first message
			if (isFirstMessage) {
				await updateChatTitle(currentChatId, locals.user.id, textContent);
			}
			
			// Update message count
			await updateChatMessageCount(currentChatId, locals.user.id);
		}

		// Truncate messages to prevent token limit issues
		const truncatedMessages = truncateMessages(processedMessages, 4000);

		// Prepare the completion request
		const completionRequest = {
			messages: truncatedMessages as ChatMessage[],
			model: model || 'moonshotai/kimi-k2:free',
			temperature,
			...(max_completion_tokens && { max_tokens: max_completion_tokens }), // Use max_tokens for API, regardless of frontend param name
			...(max_tokens && { max_tokens }), // Legacy support
			...(top_p && { top_p }),
			...(frequency_penalty && { frequency_penalty }),
			...(presence_penalty && { presence_penalty }),
			stream,
			response_format: resolvedResponseFormat,
			...(userApiKey && { apiKey: userApiKey })
		};

		// Handle streaming response
		if (stream) {
			const responseStream = await createCompletionStream(completionRequest);
			let assistantResponse = '';

			// Create a readable stream for the response
			const readableStream = new ReadableStream({
				async start(controller) {
					try {
						for await (const chunk of parseStreamResponse(responseStream)) {
							// Accumulate the response for saving to database
							const content = chunk.choices[0]?.delta?.content || '';
							assistantResponse += content;

							const data = `data: ${JSON.stringify(chunk)}\n\n`;
							controller.enqueue(new TextEncoder().encode(data));
						}

						// Save assistant response to database
						if (assistantResponse.trim()) {
							// Estimate token count for streaming responses
							const estimatedTokens = estimateTokenCount(assistantResponse.trim());
							
							await addMessage(
								currentChatId,
								'assistant',
								assistantResponse.trim(),
								model || 'moonshotai/kimi-k2:free',
								estimatedTokens, // Use estimated token count for streaming
								systemPromptData?.id,
								systemPromptData?.version,
								structuredOutputData?.id,
								structuredOutputData?.version
							);
						}

						// Send final message with chat_id
						controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
							chat_id: currentChatId,
							done: true
						})}\n\n`));
						controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
						controller.close();
					} catch (err) {
						console.error('Stream error:', err);
						controller.error(err);
					}
				}
			});

			return new Response(readableStream, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					Connection: 'keep-alive'
				}
			});
		}

		// Handle regular completion
		const completion = await createCompletion(completionRequest);

		// Save assistant response to database
		const assistantContent = completion.choices[0]?.message?.content;
		if (assistantContent) {
			await addMessage(
				currentChatId,
				'assistant',
				assistantContent,
				model || 'moonshotai/kimi-k2:free',
				completion.usage?.total_tokens, // Include token usage
				systemPromptData?.id,
				systemPromptData?.version,
				structuredOutputData?.id,
				structuredOutputData?.version
			);
		}

		// Track API usage
		await tracker.track({
			userId: locals.user.id,
			model: model || 'moonshotai/kimi-k2:free',
			tokensUsed: completion.usage?.total_tokens,
			statusCode: 200
		});

		// Track user activity
		await trackUserActivity({
			user_id: locals.user.id,
			action: 'chat_completion',
			details: {
				chat_id: currentChatId,
				model: model || 'moonshotai/kimi-k2:free',
				tokens: completion.usage?.total_tokens
			}
		});

		return json({
			id: completion.id,
			object: completion.object,
			created: completion.created,
			model: completion.model,
			choices: completion.choices,
			usage: completion.usage,
			chat_id: currentChatId
		});
	} catch (err) {
		console.error('Chat API error:', err);
		
		// Track error
		if (locals.user?.id) {
			try {
				await tracker.track({
					userId: locals.user.id,
					model: 'unknown',
					statusCode: 500,
					error: err instanceof Error ? err.message : 'Unknown error'
				});
			} catch (trackingError) {
				console.error('Failed to track error:', trackingError);
			}
		}

		if (err instanceof Error) {
			// Handle specific errors
			if (err.message.includes('OpenRouter API error')) {
				error(502, 'AI service temporarily unavailable');
			}
			if (err.message.includes('redirect')) {
				error(401, 'Authentication required');
			}
		}

		error(500, 'Internal server error');
	}
};
