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
import { authenticateApiRequest, requireScope } from '$lib/server/api-middleware.js';
import { addMessage, createChat, updateChatTitle, updateChatMessageCount } from '$lib/server/chats.js';
import { getSystemPrompt } from '$lib/server/system-prompts.js';
import { getStructuredOutput } from '$lib/server/structured-outputs.js';

export const POST: RequestHandler = async ({ request }) => {
	const startTime = Date.now();
	
	try {
		// Authenticate API request
		const auth = await authenticateApiRequest({ request } as any);
		
		// Get the request body
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
			system_prompt_id,
			structured_output_id,
			response_format,
			attachments = []
		} = await request.json();

		// Get user-provided OpenRouter API key from headers
		const userApiKey = request.headers.get('x-openrouter-api-key');

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
		let resolvedSystemPrompt = null;
		let systemPromptData = null;
		if (system_prompt_id) {
			try {
				systemPromptData = await getSystemPrompt(auth.user_id, system_prompt_id, true);
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
				structuredOutputData = await getStructuredOutput(auth.user_id, structured_output_id, true);
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

		// Process attachments into multimodal content (similar to main chat API)
		let processedMessages = [...messages];
		if (attachments && attachments.length > 0) {
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

				for (const attachment of attachments) {
					if (attachment.type === 'image' && attachment.data) {
						contentArray.push({
							type: 'image_url',
							image_url: {
								url: attachment.data,
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
					}
				}

				processedMessages[lastUserIndex] = {
					...lastMessage,
					content: contentArray
				};
			}
		}

		// Truncate messages to prevent token limit issues
		const truncatedMessages = truncateMessages(processedMessages, 4000);

		// Prepare the completion request
		const completionRequest = {
			messages: truncatedMessages as ChatMessage[],
			model: model || 'moonshotai/kimi-k2:free',
			temperature,
			...(max_completion_tokens && { max_tokens: max_completion_tokens }),
			...(max_tokens && { max_tokens }),
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

			// Create a readable stream for the response
			const readableStream = new ReadableStream({
				async start(controller) {
					try {
						for await (const chunk of parseStreamResponse(responseStream)) {
							const data = `data: ${JSON.stringify(chunk)}\n\n`;
							controller.enqueue(new TextEncoder().encode(data));
						}
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

		return json({
			id: completion.id,
			object: completion.object,
			created: completion.created,
			model: completion.model,
			choices: completion.choices,
			usage: completion.usage
		});

	} catch (err) {
		console.error('Chat completions API error:', err);
		
		if (err instanceof Error) {
			if (err.message.includes('OpenRouter API error')) {
				error(502, 'AI service temporarily unavailable');
			}
			if (err.message.includes('Authentication required')) {
				error(401, 'Authentication required');
			}
		}

		error(500, 'Internal server error');
	}
};