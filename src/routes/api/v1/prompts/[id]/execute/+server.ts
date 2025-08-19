import type { RequestHandler } from './$types';
import { createApiHandler, validateRequestBody } from '$lib/server/api-middleware.js';
import {
	executeSystemPrompt,
	type ExecutePromptRequest
} from '$lib/server/system-prompts.js';
import {
	createCompletion,
	type ChatMessage,
	type CompletionRequest
} from '$lib/server/llm.js';

// POST /api/v1/prompts/:id/execute - Execute system prompt
export const POST: RequestHandler = createApiHandler(
	async (event, auth) => {
		const promptId = event.params.id!;
		const body = await event.request.json();
		
		const executeRequest: ExecutePromptRequest = {
			variables: body.variables,
			validate_variables: body.validate_variables !== false
		};
		
		// Execute the prompt template
		const result = await executeSystemPrompt(auth.user_id, promptId, executeRequest);
		
		// If messages are provided, also create a completion
		if (body.messages && Array.isArray(body.messages)) {
			const messages: ChatMessage[] = [
				{ role: 'system', content: result.rendered_content },
				...body.messages
			];
			
			const completionRequest: CompletionRequest = {
				messages,
				model: body.model || 'openai/gpt-3.5-turbo',
				temperature: body.temperature,
				max_tokens: body.max_tokens,
				top_p: body.top_p,
				frequency_penalty: body.frequency_penalty,
				presence_penalty: body.presence_penalty,
				apiKey: event.request.headers.get('x-openrouter-api-key') || undefined
			};
			
			const completion = await createCompletion(completionRequest);
			
			return {
				prompt_execution: result,
				completion: {
					id: completion.id,
					object: completion.object,
					created: completion.created,
					model: completion.model,
					choices: completion.choices,
					usage: completion.usage
				}
			};
		}
		
		// Return just the prompt execution result
		return {
			prompt_execution: result
		};
	},
	{ required_scope: 'read' }
);