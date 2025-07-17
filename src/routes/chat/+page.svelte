<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Badge } from '$lib/components/ui/badge';
	import { 
		Send, 
		Bot, 
		User, 
		Settings, 
		RotateCcw,
		Download,
		Copy,
		Check
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	export let data: PageData;

	interface Message {
		id: string;
		role: 'user' | 'assistant' | 'system';
		content: string;
		timestamp: Date;
		model?: string;
	}

	let messages: Message[] = [];
	let currentMessage = '';
	let isLoading = false;
	let selectedModel = 'openai/gpt-3.5-turbo';
	let systemPrompt = '';
	let showSettings = false;
	let chatContainer: HTMLElement;
	let copiedMessageId: string | null = null;

	// Chat configuration
	let temperature = 0.7;
	let maxTokens = 1000;
	let streamResponse = true;

	$: availableModels = data.models || [];

	onMount(() => {
		// Load saved chat from localStorage
		const savedChat = localStorage.getItem('sveltekit-accelerator-chat');
		if (savedChat) {
			try {
				messages = JSON.parse(savedChat).map((msg: any) => ({
					...msg,
					timestamp: new Date(msg.timestamp)
				}));
			} catch (error) {
				console.error('Failed to load saved chat:', error);
			}
		}
	});

	// Save chat to localStorage whenever messages change
	$: if (messages.length > 0) {
		localStorage.setItem('sveltekit-accelerator-chat', JSON.stringify(messages));
	}

	// Auto-scroll to bottom when new messages arrive
	$: if (messages.length > 0 && chatContainer) {
		setTimeout(() => {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}, 100);
	}

	async function sendMessage() {
		if (!currentMessage.trim() || isLoading) return;

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			content: currentMessage.trim(),
			timestamp: new Date()
		};

		messages = [...messages, userMessage];
		const messageToSend = currentMessage.trim();
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
			apiMessages.push(...messages.map(msg => ({
				role: msg.role,
				content: msg.content
			})));

			if (streamResponse) {
				await handleStreamingResponse(apiMessages);
			} else {
				await handleRegularResponse(apiMessages);
			}
		} catch (error) {
			console.error('Chat error:', error);
			toast.error('Failed to send message. Please try again.');
		} finally {
			isLoading = false;
		}
	}

	async function handleStreamingResponse(apiMessages: any[]) {
		const response = await fetch('/api/chat', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				messages: apiMessages,
				model: selectedModel,
				temperature,
				max_tokens: maxTokens,
				stream: true
			})
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
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
								const content = parsed.choices[0]?.delta?.content || '';
								
								if (content) {
									messages = messages.map(msg => 
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

	async function handleRegularResponse(apiMessages: any[]) {
		const response = await fetch('/api/chat', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				messages: apiMessages,
				model: selectedModel,
				temperature,
				max_tokens: maxTokens,
				stream: false
			})
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const result = await response.json();
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
		messages = [];
		localStorage.removeItem('sveltekit-accelerator-chat');
		toast.success('Chat cleared');
	}

	function exportChat() {
		const chatData = {
			messages,
			model: selectedModel,
			systemPrompt,
			exportedAt: new Date().toISOString()
		};

		const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success('Chat exported');
	}

	async function copyMessage(messageId: string, content: string) {
		try {
			await navigator.clipboard.writeText(content);
			copiedMessageId = messageId;
			toast.success('Message copied to clipboard');
			setTimeout(() => {
				copiedMessageId = null;
			}, 2000);
		} catch (error) {
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
</script>

<svelte:head>
	<title>AI Chat - SvelteKit Accelerator</title>
	<meta name="description" content="Chat with AI using OpenRouter" />
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<!-- Header -->
	<div class="mb-6">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">AI Chat</h1>
				<p class="text-muted-foreground">
					Powered by OpenRouter • Model: {selectedModel}
				</p>
			</div>
			<div class="flex items-center space-x-2">
				<Button
					variant="outline"
					size="sm"
					on:click={() => showSettings = !showSettings}
				>
					<Settings class="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="sm"
					on:click={exportChat}
					disabled={messages.length === 0}
				>
					<Download class="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="sm"
					on:click={clearChat}
					disabled={messages.length === 0}
				>
					<RotateCcw class="h-4 w-4" />
				</Button>
			</div>
		</div>
	</div>

	<!-- Settings Panel -->
	{#if showSettings}
		<Card.Root class="mb-6">
			<Card.Header>
				<Card.Title>Chat Settings</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label class="text-sm font-medium mb-2 block">Model</label>
						<Select.Root bind:selected={selectedModel}>
							<Select.Trigger>
								<Select.Value placeholder="Select model" />
							</Select.Trigger>
							<Select.Content>
								{#each availableModels as model}
									<Select.Item value={model.id}>
										{model.name || model.id}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					<div>
						<label class="text-sm font-medium mb-2 block">
							Temperature: {temperature}
						</label>
						<input
							type="range"
							min="0"
							max="2"
							step="0.1"
							bind:value={temperature}
							class="w-full"
						/>
					</div>

					<div>
						<label class="text-sm font-medium mb-2 block">
							Max Tokens: {maxTokens}
						</label>
						<input
							type="range"
							min="100"
							max="4000"
							step="100"
							bind:value={maxTokens}
							class="w-full"
						/>
					</div>

					<div class="flex items-center space-x-2">
						<input
							type="checkbox"
							id="stream"
							bind:checked={streamResponse}
							class="rounded"
						/>
						<label for="stream" class="text-sm font-medium">
							Stream responses
						</label>
					</div>
				</div>

				<div>
					<label class="text-sm font-medium mb-2 block">System Prompt</label>
					<Textarea
						bind:value={systemPrompt}
						placeholder="Enter system prompt to guide the AI's behavior..."
						class="min-h-[100px]"
					/>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Chat Container -->
	<Card.Root class="flex flex-col h-[600px]">
		<!-- Messages -->
		<div
			bind:this={chatContainer}
			class="flex-1 overflow-y-auto p-4 space-y-4"
		>
			{#if messages.length === 0}
				<div class="text-center text-muted-foreground py-12">
					<Bot class="h-12 w-12 mx-auto mb-4 opacity-50" />
					<p class="text-lg font-medium">Start a conversation</p>
					<p class="text-sm">Ask me anything!</p>
				</div>
			{/if}

			{#each messages as message}
				<div class="flex items-start space-x-3">
					<div class="flex-shrink-0">
						{#if message.role === 'user'}
							<div class="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
								<User class="h-4 w-4 text-primary-foreground" />
							</div>
						{:else}
							<div class="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
								<Bot class="h-4 w-4 text-secondary-foreground" />
							</div>
						{/if}
					</div>

					<div class="flex-1 min-w-0">
						<div class="flex items-center space-x-2 mb-1">
							<span class="text-sm font-medium">
								{message.role === 'user' ? 'You' : 'AI'}
							</span>
							{#if message.model}
								<Badge variant="secondary" class="text-xs">
									{message.model}
								</Badge>
							{/if}
							<span class="text-xs text-muted-foreground">
								{formatTimestamp(message.timestamp)}
							</span>
						</div>

						<div class="prose prose-sm max-w-none">
							<pre class="whitespace-pre-wrap text-sm">{message.content}</pre>
						</div>

						<div class="mt-2">
							<Button
								variant="ghost"
								size="sm"
								on:click={() => copyMessage(message.id, message.content)}
							>
								{#if copiedMessageId === message.id}
									<Check class="h-3 w-3" />
								{:else}
									<Copy class="h-3 w-3" />
								{/if}
							</Button>
						</div>
					</div>
				</div>
			{/each}

			{#if isLoading}
				<div class="flex items-start space-x-3">
					<div class="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
						<Bot class="h-4 w-4 text-secondary-foreground" />
					</div>
					<div class="flex-1">
						<div class="flex items-center space-x-2 mb-1">
							<span class="text-sm font-medium">AI</span>
							<span class="text-xs text-muted-foreground">thinking...</span>
						</div>
						<div class="flex space-x-1">
							<div class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
							<div class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
							<div class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Input -->
		<div class="border-t p-4">
			<div class="flex space-x-2">
				<Textarea
					bind:value={currentMessage}
					placeholder="Type your message..."
					class="flex-1 min-h-[60px] resize-none"
					on:keydown={handleKeyDown}
					disabled={isLoading}
				/>
				<Button
					on:click={sendMessage}
					disabled={!currentMessage.trim() || isLoading}
					class="px-6"
				>
					<Send class="h-4 w-4" />
				</Button>
			</div>
		</div>
	</Card.Root>
</div>