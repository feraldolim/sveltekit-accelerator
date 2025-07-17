import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCompletion, createCompletionStream, parseStreamResponse, truncateMessages, type ChatMessage } from '$lib/server/llm.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Require authentication
		if (!locals.session || !locals.user) {
			error(401, 'Authentication required');
		}
		
		const { messages, model, stream = false, temperature = 0.7, max_tokens } = await request.json();

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

		// Truncate messages to prevent token limit issues
		const truncatedMessages = truncateMessages(messages, 4000);

		// Prepare the completion request
		const completionRequest = {
			messages: truncatedMessages as ChatMessage[],
			model: model || 'openai/gpt-3.5-turbo',
			temperature,
			max_tokens,
			stream
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
						
						// Send final message
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
					'Connection': 'keep-alive'
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
		console.error('Chat API error:', err);
		
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