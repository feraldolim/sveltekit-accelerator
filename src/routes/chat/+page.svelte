<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { marked } from 'marked';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Badge } from '$lib/components/ui/badge';
	import { Label } from '$lib/components/ui/label';
	import { Send, Bot, User, Settings, RotateCcw, Sparkles, Copy, Check, Key, AlertTriangle } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	interface Message {
		id: string;
		role: 'user' | 'assistant' | 'system';
		content: string;
		timestamp: Date;
		model?: string;
	}

	let messages: Message[] = $state([]);
	let currentMessage = $state('');
	let isLoading = $state(false);
	let selectedModel = $state('moonshotai/kimi-k2:free');
	let systemPrompt = $state('');
	let showSettings = $state(false);
	let chatContainer: HTMLElement;
	let messageInput: any;
	let copiedMessageId: string | null = $state(null);
	let currentChatId: string | null = $state(null);

	// Chat configuration
	let temperature = $state(0.7);
	let maxTokens = $state(2000);
	let streamResponse = $state(true);

	// API Key management
	let userApiKey = $state('');
	let showApiKeyDialog = $state(false);
	let apiKeyTestResult = $state<'idle' | 'testing' | 'success' | 'error'>('idle');

	const availableModels = $derived((data.models || []) as Array<{id: string, name?: string}>);
	
	const triggerContent = $derived(
		availableModels.find((m) => m.id === selectedModel)?.name || 
		availableModels.find((m) => m.id === selectedModel)?.id || 
		"Select model"
	);
	const hasMessages = $derived(messages.length > 0);

	// Configure marked for better rendering
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	onMount(() => {
		// Focus input after mount
		if (messageInput && messageInput.focus) {
			messageInput.focus();
		}

		// Load saved API key from localStorage
		const savedApiKey = localStorage.getItem('openrouter-api-key');
		if (savedApiKey) {
			userApiKey = savedApiKey;
		}
	});

	// Save API key to localStorage when it changes
	$effect(() => {
		if (userApiKey) {
			localStorage.setItem('openrouter-api-key', userApiKey);
		} else {
			localStorage.removeItem('openrouter-api-key');
		}
	});

	// Test API key validity
	async function testApiKey() {
		if (!userApiKey.trim()) {
			toast.error('Please enter an API key');
			return;
		}

		apiKeyTestResult = 'testing';

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-OpenRouter-API-Key': userApiKey.trim()
				},
				body: JSON.stringify({
					messages: [{ role: 'user', content: 'Hello' }],
					model: 'openai/gpt-3.5-turbo',
					max_tokens: 1
				})
			});

			if (response.ok) {
				apiKeyTestResult = 'success';
				toast.success('API key is valid');
			} else {
				apiKeyTestResult = 'error';
				const errorText = await response.text();
				toast.error(`Invalid API key: ${errorText}`);
			}
		} catch (error) {
			apiKeyTestResult = 'error';
			toast.error('Failed to test API key');
		}

		// Reset test result after 3 seconds
		setTimeout(() => {
			apiKeyTestResult = 'idle';
		}, 3000);
	}

	// Start a new chat session
	function startNewChat() {
		messages = [];
		currentChatId = null;
		currentMessage = '';
		toast.success('Started new chat');
	}

	// Auto-scroll to bottom when new messages arrive
	$effect(() => {
		if (messages.length > 0 && chatContainer) {
			tick().then(() => {
				chatContainer.scrollTo({
					top: chatContainer.scrollHeight,
					behavior: 'smooth'
				});
			});
		}
	});

	async function sendMessage() {
		if (!currentMessage.trim() || isLoading) return;

		// Check if API key is provided
		if (!userApiKey.trim()) {
			showApiKeyDialog = true;
			toast.error('Please provide your OpenRouter API key to use the chat');
			return;
		}

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			content: currentMessage.trim(),
			timestamp: new Date()
		};

		messages = [...messages, userMessage];
		currentMessage = '';
		isLoading = true;

		try {
			// Prepare messages for API
			const apiMessages = [];

			// Add system prompt if provided
			if (systemPrompt.trim()) {
				apiMessages.push({
					role: 'system',
					content: systemPrompt.trim()
				});
			}

			// Add conversation history
			apiMessages.push(
				...messages.map((msg) => ({
					role: msg.role,
					content: msg.content
				}))
			);

			if (streamResponse) {
				await handleStreamingResponse(apiMessages);
			} else {
				await handleRegularResponse(apiMessages);
			}
		} catch (error) {
			console.error('Chat error:', error);
			toast.error('Failed to send message. Please try again.');
			// Remove the user message if it failed
			messages = messages.filter((msg) => msg.id !== userMessage.id);
		} finally {
			isLoading = false;
		}
	}

	async function handleStreamingResponse(apiMessages: unknown[]) {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		// Add API key if provided
		if (userApiKey.trim()) {
			headers['X-OpenRouter-API-Key'] = userApiKey.trim();
		}

		const response = await fetch('/api/chat', {
			method: 'POST',
			headers,
			body: JSON.stringify({
				messages: apiMessages,
				model: selectedModel,
				temperature,
				max_tokens: maxTokens,
				stream: true,
				chat_id: currentChatId,
				system_prompt: systemPrompt.trim() || undefined
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();

		const assistantMessage: Message = {
			id: crypto.randomUUID(),
			role: 'assistant',
			content: '',
			timestamp: new Date(),
			model: selectedModel
		};

		messages = [...messages, assistantMessage];

		if (reader) {
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = decoder.decode(value);
					const lines = chunk.split('\n');

					for (const line of lines) {
						if (line.startsWith('data: ')) {
							const data = line.slice(6);
							if (data === '[DONE]') return;

							try {
								const parsed = JSON.parse(data);
								
								// Handle chat_id from response
								if (parsed.chat_id && !currentChatId) {
									currentChatId = parsed.chat_id;
								}

								const content = parsed.choices[0]?.delta?.content || '';

								if (content) {
									messages = messages.map((msg) =>
										msg.id === assistantMessage.id
											? { ...msg, content: msg.content + content }
											: msg
									);
								}
							} catch (e) {
								console.warn('Failed to parse streaming data:', e);
							}
						}
					}
				}
			} finally {
				reader.releaseLock();
			}
		}
	}

	async function handleRegularResponse(apiMessages: unknown[]) {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		// Add API key if provided
		if (userApiKey.trim()) {
			headers['X-OpenRouter-API-Key'] = userApiKey.trim();
		}

		const response = await fetch('/api/chat', {
			method: 'POST',
			headers,
			body: JSON.stringify({
				messages: apiMessages,
				model: selectedModel,
				temperature,
				max_tokens: maxTokens,
				stream: false,
				chat_id: currentChatId,
				system_prompt: systemPrompt.trim() || undefined
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		
		// Update chat_id if this was a new chat
		if (result.chat_id && !currentChatId) {
			currentChatId = result.chat_id;
		}

		const assistantMessage: Message = {
			id: crypto.randomUUID(),
			role: 'assistant',
			content: result.choices[0]?.message?.content || 'No response',
			timestamp: new Date(),
			model: selectedModel
		};

		messages = [...messages, assistantMessage];
	}

	function clearChat() {
		startNewChat();
	}

	async function copyMessage(messageId: string, content: string) {
		try {
			await navigator.clipboard.writeText(content);
			copiedMessageId = messageId;
			toast.success('Message copied');
			setTimeout(() => {
				copiedMessageId = null;
			}, 2000);
		} catch {
			toast.error('Failed to copy message');
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	function formatTimestamp(date: Date) {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function renderMarkdown(content: string): string {
		return marked(content) as string;
	}
</script>

<svelte:head>
	<title>AI Chat - SvelteKit Accelerator</title>
	<meta name="description" content="Chat with AI using OpenRouter" />
</svelte:head>

<div class="container mx-auto h-[calc(100vh-4rem)] px-4 py-6">
	<!-- Settings Dialog -->
	<Dialog.Root bind:open={showSettings}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>Chat Settings</Dialog.Title>
				<Dialog.Description>Customize your chat experience</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-4">
				<div>
					<Label>Model</Label>
					<Select.Root type="single" name="model" bind:value={selectedModel}>
						<Select.Trigger class="w-full">
							{triggerContent}
						</Select.Trigger>
						<Select.Content>
							<Select.Group>
								<Select.Label>Available Models</Select.Label>
								{#each availableModels as model (model.id)}
									<Select.Item
										value={model.id}
										label={model.name || model.id}
									>
										{model.name || model.id}
									</Select.Item>
								{/each}
							</Select.Group>
						</Select.Content>
					</Select.Root>
				</div>

				<div>
					<Label for="temperature-range">Temperature: {temperature}</Label>
					<input id="temperature-range" type="range" min="0" max="2" step="0.1" bind:value={temperature} class="w-full" />
				</div>

				<div>
					<Label for="tokens-range">Max Tokens: {maxTokens}</Label>
					<input
						id="tokens-range"
						type="range"
						min="100"
						max="4000"
						step="100"
						bind:value={maxTokens}
						class="w-full"
					/>
				</div>

				<div class="flex items-center space-x-2">
					<input type="checkbox" id="stream" bind:checked={streamResponse} class="rounded" />
					<Label for="stream">Stream responses</Label>
				</div>

				<div>
					<Label for="system-prompt">System Prompt</Label>
					<Textarea
						id="system-prompt"
						bind:value={systemPrompt}
						placeholder="Enter system prompt to guide the AI's behavior..."
						class="min-h-[100px]"
					/>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Root>

	<!-- API Key Dialog -->
	<Dialog.Root bind:open={showApiKeyDialog}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title class="flex items-center gap-2">
					<Key class="h-5 w-5" />
					OpenRouter API Key
				</Dialog.Title>
				<Dialog.Description>
					Enter your OpenRouter API key to use the chat. Get your key from <a href="https://openrouter.ai/keys" target="_blank" class="text-primary underline">openrouter.ai/keys</a>
				</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-4">
				<div>
					<Label for="api-key">API Key</Label>
					<Input
						id="api-key"
						type="password"
						bind:value={userApiKey}
						placeholder="sk-or-v1-..."
						class="mt-2"
					/>
					<p class="text-xs text-muted-foreground mt-1">
						Your API key is stored locally in your browser and never sent to our servers
					</p>
				</div>
				
				<div class="flex gap-2">
					<Button 
						variant="outline" 
						onclick={testApiKey} 
						disabled={!userApiKey.trim() || apiKeyTestResult === 'testing'}
						class="flex-1"
					>
						{#if apiKeyTestResult === 'testing'}
							Testing...
						{:else if apiKeyTestResult === 'success'}
							<Check class="h-4 w-4 mr-2" />
							Valid
						{:else if apiKeyTestResult === 'error'}
							<AlertTriangle class="h-4 w-4 mr-2" />
							Invalid
						{:else}
							Test Key
						{/if}
					</Button>
					<Button 
						onclick={() => showApiKeyDialog = false} 
						disabled={!userApiKey.trim()}
						class="flex-1"
					>
						Save
					</Button>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Root>

	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div class="flex items-center space-x-3">
			<div class="bg-primary rounded-lg p-2">
				<Sparkles class="text-primary-foreground h-6 w-6" />
			</div>
			<div>
				<h1 class="text-2xl font-bold">AI Chat</h1>
				<p class="text-muted-foreground text-sm">
					Powered by {selectedModel}
				</p>
			</div>
		</div>
		<div class="flex items-center space-x-2">
			<Button variant="outline" size="sm" onclick={() => (showApiKeyDialog = true)}>
				<Key class="h-4 w-4" />
			</Button>
			<Button variant="outline" size="sm" onclick={() => (showSettings = true)}>
				<Settings class="h-4 w-4" />
			</Button>
			<Button variant="outline" size="sm" onclick={clearChat} disabled={messages.length === 0}>
				<RotateCcw class="h-4 w-4" />
			</Button>
		</div>
	</div>

	<!-- API Key Warning -->
	{#if !userApiKey.trim()}
		<div class="mb-4">
			<Alert.Root class="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
				<AlertTriangle class="h-4 w-4" />
				<Alert.Title>API Key Required</Alert.Title>
				<Alert.Description class="flex items-center justify-between">
					<span>You need to provide your own OpenRouter API key to use the chat.</span>
					<Button size="sm" onclick={() => showApiKeyDialog = true} class="ml-4">
						<Key class="h-4 w-4 mr-2" />
						Set API Key
					</Button>
				</Alert.Description>
			</Alert.Root>
		</div>
	{/if}

	<!-- Chat Area -->
	<div class="flex h-[calc(100%-8rem)] flex-col">
		<!-- Messages -->
		<div bind:this={chatContainer} class="mb-4 flex-1 overflow-y-auto">
			{#if messages.length === 0}
				<!-- Welcome Screen -->
				<Card.Root class="flex h-full items-center justify-center">
					<Card.Content class="py-12 text-center">
						<div class="bg-primary mb-6 inline-flex items-center justify-center rounded-full p-4">
							<Sparkles class="text-primary-foreground h-8 w-8" />
						</div>
						<h2 class="mb-2 text-xl font-semibold">Welcome to AI Chat</h2>
						<p class="text-muted-foreground mx-auto mb-6 max-w-md">
							Start a conversation with our AI assistant. Ask questions, get help, or just chat!
						</p>
					</Card.Content>
				</Card.Root>
			{:else}
				<!-- Messages List -->
				<div class="space-y-4">
					{#each messages as message (message.id)}
						<div class="group flex items-start space-x-3">
							<div class="flex-shrink-0">
								{#if message.role === 'user'}
									<div class="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
										<User class="text-primary-foreground h-4 w-4" />
									</div>
								{:else}
									<div class="bg-secondary flex h-8 w-8 items-center justify-center rounded-full">
										<Bot class="text-secondary-foreground h-4 w-4" />
									</div>
								{/if}
							</div>

							<div class="min-w-0 flex-1">
								<div class="mb-2 flex items-center space-x-2">
									<span class="text-sm font-medium">
										{message.role === 'user' ? 'You' : 'AI Assistant'}
									</span>
									{#if message.model}
										<Badge variant="secondary" class="text-xs">
											{message.model}
										</Badge>
									{/if}
									<span class="text-muted-foreground text-xs">
										{formatTimestamp(message.timestamp)}
									</span>
								</div>

								<Card.Root>
									<Card.Content class="p-2">
										{#if message.role === 'user'}
											<div class="prose prose-sm dark:prose-invert max-w-none">
												<p class="m-0 whitespace-pre-wrap text-sm">{message.content}</p>
											</div>
										{:else}
											<div class="prose prose-sm dark:prose-invert max-w-none [&>*]:text-sm [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
												<!-- eslint-disable-next-line svelte/no-at-html-tags -->
												{@html renderMarkdown(message.content)}
											</div>
										{/if}
									</Card.Content>
								</Card.Root>

								<div class="mt-2 opacity-0 transition-opacity group-hover:opacity-100">
									<Button
										variant="ghost"
										size="sm"
										onclick={() => copyMessage(message.id, message.content)}
										class="h-6 text-xs"
									>
										{#if copiedMessageId === message.id}
											<Check class="mr-1 h-3 w-3" />
											Copied
										{:else}
											<Copy class="mr-1 h-3 w-3" />
											Copy
										{/if}
									</Button>
								</div>
							</div>
						</div>
					{/each}

					{#if isLoading}
						<div class="flex items-start space-x-3">
							<div class="bg-secondary flex h-8 w-8 items-center justify-center rounded-full">
								<Bot class="text-secondary-foreground h-4 w-4" />
							</div>
							<div class="flex-1">
								<div class="mb-2 flex items-center space-x-2">
									<span class="text-sm font-medium">AI Assistant</span>
									<span class="text-muted-foreground text-xs">thinking...</span>
								</div>
								<Card.Root>
									<Card.Content class="p-2">
										<div class="flex space-x-1">
											<div class="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"></div>
											<div
												class="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
												style="animation-delay: 0.1s"
											></div>
											<div
												class="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
												style="animation-delay: 0.2s"
											></div>
										</div>
									</Card.Content>
								</Card.Root>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Input Area -->
		<div class="border-t pt-4">
			<div class="flex space-x-2 items-end">
				<div class="flex-1">
					<Textarea
						bind:this={messageInput}
						bind:value={currentMessage}
						placeholder="Type your message..."
						class="min-h-[60px] resize-none"
						onkeydown={handleKeyDown}
						disabled={isLoading}
					/>
				</div>
				<Button
					onclick={sendMessage}
					disabled={!currentMessage.trim() || isLoading}
					size="default"
				>
					<Send class="h-4 w-4" />
				</Button>
			</div>

			<p class="text-muted-foreground mt-2 text-center text-sm">
				Press Enter to send, Shift+Enter for new line
			</p>
		</div>
	</div>
</div>
