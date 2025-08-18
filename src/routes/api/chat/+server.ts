import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createCompletion,
	createCompletionStream,
	parseStreamResponse,
	truncateMessages,
	type ChatMessage
} from '$lib/server/llm.js';
import { addMessage, createChat, updateChatTitle } from '$lib/server/chats.js';
import { createApiTracker, trackUserActivity } from '$lib/server/analytics.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	const startTime = Date.now();
	const tracker = createApiTracker({ request, locals } as any, startTime);
	
	try {
		// Require authentication
		if (!locals.session || !locals.user) {
			error(401, 'Authentication required');
		}

		const { 
			messages, 
			model, 
			stream = false, 
			temperature = 0.7, 
			max_tokens,
			chat_id,
			system_prompt 
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

		// Create or use existing chat
		let currentChatId = chat_id;
		let isFirstMessage = false;
		
		if (!currentChatId) {
			// Create a new chat
			const newChat = await createChat(
				locals.user.id,
				'New Chat',
				model || 'moonshotai/kimi-k2:free',
				system_prompt
			);
			currentChatId = newChat.id;
			isFirstMessage = true;
		}

		// Get the last user message to save to database
		const lastUserMessage = messages[messages.length - 1];
		if (lastUserMessage && lastUserMessage.role === 'user') {
			await addMessage(
				currentChatId,
				'user',
				lastUserMessage.content,
				model || 'moonshotai/kimi-k2:free'
			);

			// Update chat title if this is the first message
			if (isFirstMessage) {
				await updateChatTitle(currentChatId, locals.user.id, lastUserMessage.content);
			}
		}

		// Truncate messages to prevent token limit issues
		const truncatedMessages = truncateMessages(messages, 4000);

		// Prepare the completion request
		const completionRequest = {
			messages: truncatedMessages as ChatMessage[],
			model: model || 'moonshotai/kimi-k2:free',
			temperature,
			max_tokens,
			stream
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
							await addMessage(
								currentChatId,
								'assistant',
								assistantResponse.trim(),
								model || 'moonshotai/kimi-k2:free'
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
				model || 'moonshotai/kimi-k2:free'
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
			await tracker.track({
				userId: locals.user.id,
				model: model || 'moonshotai/kimi-k2:free',
				statusCode: 500,
				error: err instanceof Error ? err.message : 'Unknown error'
			});
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
