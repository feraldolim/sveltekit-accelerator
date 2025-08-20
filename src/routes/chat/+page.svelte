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
	import { Switch } from '$lib/components/ui/switch';
	import { Separator } from '$lib/components/ui/separator';
	import { 
		Send, 
		Bot, 
		User, 
		Settings, 
		RotateCcw, 
		Sparkles, 
		Copy, 
		Check, 
		Key, 
		AlertTriangle,
		Plus,
		Eye,
		EyeOff,
		FileText,
		Image,
		Upload,
		X,
		ChevronLeft,
		ChevronRight,
		MessageSquare,
		Search,
		Pin,
		PinOff,
		Download,
		Code,
		Braces,
		Globe,
		Lock,
		History
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	interface Message {
		id: string;
		role: 'user' | 'assistant' | 'system';
		content: string;
		timestamp: Date;
		model?: string;
		attachments?: Attachment[];
	}

	interface Attachment {
		id: string;
		type: 'image' | 'pdf' | 'audio' | 'text';
		name: string;
		size: number;
		data: string; // Base64 data URI
		url?: string;
	}

	interface SystemPrompt {
		id: string;
		name: string;
		description?: string;
		content: string;
		version: number;
		category: string;
		is_public: boolean;
		usage_count: number;
	}

	interface StructuredOutput {
		id: string;
		name: string;
		description?: string;
		json_schema: any;
		version: number;
		is_public: boolean;
		usage_count: number;
	}

	interface Conversation {
		id: string;
		title: string;
		model: string;
		system_prompt?: string;
		created_at: string;
		updated_at: string;
		message_count: number;
		is_pinned?: boolean;
	}

	// Core state
	let messages: Message[] = $state([]);
	let currentMessage = $state('');
	let isLoading = $state(false);
	let selectedModel: {id: string, name?: string} | null = $state(null);
	let selectedModelId = $state('moonshotai/kimi-k2:free');
	let systemPrompt = $state('');
	let currentChatId: string | null = $state(null);

	// UI state
	let showSettings = $state(false);
	let showApiKeyDialog = $state(false);
	let showSidebar = $state(true);
	let showRightPanel = $state(false);
	let copiedMessageId: string | null = $state(null);
	let sidebarTab = $state<'prompts' | 'outputs' | 'conversations'>('conversations');

	// Chat configuration
	let temperature = $state(0.7);
	let maxTokens = $state(2000);
	let streamResponse = $state(true);

	// API Key management
	let userApiKey = $state('');
	let apiKeyTestResult = $state<'idle' | 'testing' | 'success' | 'error'>('idle');

	// Enhanced features
	let selectedSystemPrompt: SystemPrompt | null = $state(null);
	let useStructuredOutput = $state(false);
	let selectedStructuredOutput: StructuredOutput | null = $state(null);
	let attachments: Attachment[] = $state([]);
	let searchQuery = $state('');
	let isDragOver = $state(false);

	// Data from server
	const availableModels = $derived((data.models || []) as Array<{id: string, name?: string}>);
	const systemPrompts = $derived((data.systemPrompts || []) as SystemPrompt[]);
	const structuredOutputs = $derived((data.structuredOutputs || []) as StructuredOutput[]);
	
	// Conversations state - reactive to both server data and new chats
	let conversations = $state((data.chats || []) as Conversation[]);

	// Computed values
	const triggerContent = $derived(() => {
		const model = availableModels.find(m => m.id === selectedModelId);
		return model?.name || model?.id || "Select model";
	});
	const hasMessages = $derived(messages.length > 0);
	const hasAttachments = $derived(attachments.length > 0);

	// Filter conversations based on search
	const filteredConversations = $derived(
		searchQuery 
			? conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
			: conversations
	);

	// Configure marked for better rendering
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	let chatContainer: HTMLElement;
	let messageInput: any;
	let fileInput: HTMLInputElement;

	onMount(() => {
		// Set default model when data is available
		if (!selectedModel && availableModels.length > 0) {
			selectedModel = availableModels.find(m => m.id === selectedModelId) || availableModels[0];
			selectedModelId = selectedModel.id;
		}
		// Focus input after mount
		if (messageInput && messageInput.focus) {
			messageInput.focus();
		}

		// Load saved API key from localStorage
		const savedApiKey = localStorage.getItem('openrouter-api-key');
		if (savedApiKey) {
			userApiKey = savedApiKey;
		}

		// Set up drag and drop
		document.addEventListener('dragover', handleDragOver);
		document.addEventListener('drop', handleDrop);
		document.addEventListener('dragleave', handleDragLeave);

		return () => {
			document.removeEventListener('dragover', handleDragOver);
			document.removeEventListener('drop', handleDrop);
			document.removeEventListener('dragleave', handleDragLeave);
		};
	});

	// Save API key to localStorage when it changes
	$effect(() => {
		if (userApiKey) {
			localStorage.setItem('openrouter-api-key', userApiKey);
		} else {
			localStorage.removeItem('openrouter-api-key');
		}
	});

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

	// Sync selectedModelId with selectedModel
	$effect(() => {
		if (selectedModelId && availableModels.length > 0) {
			selectedModel = availableModels.find(m => m.id === selectedModelId) || availableModels[0];
		}
	});

	// File upload handlers
	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		if (!e.relatedTarget) {
			isDragOver = false;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		
		if (e.dataTransfer?.files) {
			handleFiles(Array.from(e.dataTransfer.files));
		}
	}

	function handleFileSelect() {
		if (fileInput?.files) {
			handleFiles(Array.from(fileInput.files));
		}
	}

	async function handleFiles(files: File[]) {
		for (const file of files) {
			if (file.size > 10 * 1024 * 1024) { // 10MB limit
				toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
				continue;
			}

			// Determine file type
			let type: 'image' | 'pdf' | 'audio' | 'text' = 'text';
			if (file.type.startsWith('image/')) {
				type = 'image';
			} else if (file.type === 'application/pdf') {
				type = 'pdf';
			} else if (file.type.startsWith('audio/')) {
				type = 'audio';
			}

			try {
				const base64 = await fileToBase64(file);
				const attachment: Attachment = {
					id: crypto.randomUUID(),
					type,
					name: file.name,
					size: file.size,
					data: base64
				};
				
				attachments = [...attachments, attachment];
				toast.success(`Added ${file.name}`);
			} catch (error) {
				toast.error(`Failed to process ${file.name}`);
			}
		}
	}

	function fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	function removeAttachment(id: string) {
		attachments = attachments.filter(a => a.id !== id);
	}

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
		attachments = [];
		selectedSystemPrompt = null;
		useStructuredOutput = false;
		selectedStructuredOutput = null;
		toast.success('Started new chat');
	}

	async function updateConversationsList(newChatId: string) {
		try {
			// Fetch the new chat details from the server
			const response = await fetch(`/api/chats/${newChatId}`);
			if (response.ok) {
				const newChat = await response.json();
				// Add the new chat to the beginning of the conversations list
				conversations = [newChat, ...conversations];
			}
		} catch (error) {
			console.warn('Failed to update conversations list:', error);
		}
	}

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
			timestamp: new Date(),
			attachments: attachments.length > 0 ? [...attachments] : undefined
		};

		messages = [...messages, userMessage];
		currentMessage = '';
		const messagesToSend = [...messages];
		const currentAttachments = [...attachments];
		attachments = []; // Clear attachments after sending
		isLoading = true;

		try {
			// Prepare messages for API - system prompt is now handled via ID
			const apiMessages = messagesToSend.map((msg) => ({
				role: msg.role,
				content: msg.content
			}));

			// Prepare attachments for API
			const apiAttachments = currentAttachments.map(att => ({
				type: att.type,
				data: att.data,
				name: att.name
			}));

			if (streamResponse) {
				await handleStreamingResponse(apiMessages, apiAttachments);
			} else {
				await handleRegularResponse(apiMessages, apiAttachments);
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

	async function handleStreamingResponse(apiMessages: unknown[], apiAttachments: unknown[]) {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		// Add API key if provided
		if (userApiKey.trim()) {
			headers['X-OpenRouter-API-Key'] = userApiKey.trim();
		}

		const requestBody: any = {
			messages: apiMessages,
			model: selectedModel?.id || 'moonshotai/kimi-k2:free',
			temperature,
			max_tokens: maxTokens,
			stream: true,
			chat_id: currentChatId,
			attachments: apiAttachments
		};

		// Add system prompt ID if selected
		if (selectedSystemPrompt) {
			requestBody.system_prompt_id = selectedSystemPrompt.id;
		}

		// Add structured output if enabled
		if (useStructuredOutput && selectedStructuredOutput) {
			requestBody.structured_output_id = selectedStructuredOutput.id;
		}

		const response = await fetch('/api/chat', {
			method: 'POST',
			headers,
			body: JSON.stringify(requestBody)
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
			model: selectedModel?.id || 'moonshotai/kimi-k2:free'
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
									// Update conversations list with the new chat
									updateConversationsList(parsed.chat_id);
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

	async function handleRegularResponse(apiMessages: unknown[], apiAttachments: unknown[]) {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		// Add API key if provided
		if (userApiKey.trim()) {
			headers['X-OpenRouter-API-Key'] = userApiKey.trim();
		}

		const requestBody: any = {
			messages: apiMessages,
			model: selectedModel?.id || 'moonshotai/kimi-k2:free',
			temperature,
			max_tokens: maxTokens,
			stream: false,
			chat_id: currentChatId,
			attachments: apiAttachments
		};

		// Add system prompt ID if selected
		if (selectedSystemPrompt) {
			requestBody.system_prompt_id = selectedSystemPrompt.id;
		}

		// Add structured output if enabled
		if (useStructuredOutput && selectedStructuredOutput) {
			requestBody.structured_output_id = selectedStructuredOutput.id;
		}

		const response = await fetch('/api/chat', {
			method: 'POST',
			headers,
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const result = await response.json();
		
		// Update chat_id if this was a new chat
		if (result.chat_id && !currentChatId) {
			currentChatId = result.chat_id;
			// Update conversations list with the new chat
			updateConversationsList(result.chat_id);
		}

		const assistantMessage: Message = {
			id: crypto.randomUUID(),
			role: 'assistant',
			content: result.choices[0]?.message?.content || 'No response',
			timestamp: new Date(),
			model: selectedModel?.id || 'moonshotai/kimi-k2:free'
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

	function formatTimestamp(date: Date | string) {
		if (!date) return '';
		const dateObj = typeof date === 'string' ? new Date(date) : date;
		if (isNaN(dateObj.getTime())) return '';
		return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function renderMarkdown(content: string): string {
		return marked(content) as string;
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function getFileIcon(type: string) {
		switch (type) {
			case 'image': return Image;
			case 'pdf': return FileText;
			case 'audio': return FileText;
			default: return FileText;
		}
	}

	function selectSystemPrompt(prompt: SystemPrompt) {
		selectedSystemPrompt = prompt;
		toast.success(`Selected prompt: ${prompt.name}`);
	}

	function selectStructuredOutput(output: StructuredOutput) {
		selectedStructuredOutput = output;
		toast.success(`Selected schema: ${output.name}`);
	}

	async function loadConversation(conversation: Conversation) {
		try {
			const response = await fetch(`/api/chats/${conversation.id}/details`);
			if (!response.ok) {
				throw new Error('Failed to load conversation');
			}
			
			const data = await response.json();
			
			// Update chat state with loaded conversation
			currentChatId = conversation.id;
			messages = data.messages || [];
			
			// Update chat metadata if available
			if (data.chat.system_prompt_id) {
				const systemPrompt = systemPrompts.find(p => p.id === data.chat.system_prompt_id);
				if (systemPrompt) {
					selectedSystemPrompt = systemPrompt;
				}
			}
			
			if (data.chat.structured_output_id) {
				const structuredOutput = structuredOutputs.find(s => s.id === data.chat.structured_output_id);
				if (structuredOutput) {
					selectedStructuredOutput = structuredOutput;
					useStructuredOutput = true;
				}
			}
			
			if (data.chat.model) {
				selectedModel = availableModels.find(m => m.id === data.chat.model) || availableModels[0];
			}
			
			toast.success(`Loaded conversation: ${conversation.title}`);
		} catch (error) {
			console.error('Failed to load conversation:', error);
			toast.error('Failed to load conversation');
		}
	}
</script>

<svelte:head>
	<title>AI Chat - SvelteKit Accelerator</title>
	<meta name="description" content="Enhanced chat with AI using OpenRouter" />
</svelte:head>

<!-- File input (hidden) -->
<input 
	type="file" 
	bind:this={fileInput}
	onchange={handleFileSelect}
	multiple
	accept="image/*,.pdf,audio/*,.txt,.md,.json,.csv"
	class="hidden"
/>

<!-- Drag overlay -->
{#if isDragOver}
	<div class="fixed inset-0 z-50 bg-primary/20 backdrop-blur-sm flex items-center justify-center">
		<div class="bg-background border-2 border-dashed border-primary rounded-lg p-8 text-center">
			<Upload class="h-12 w-12 mx-auto mb-4 text-primary" />
			<p class="text-lg font-semibold">Drop files to upload</p>
			<p class="text-sm text-muted-foreground">Images, PDFs, audio files, and text documents</p>
		</div>
	</div>
{/if}

<div class="flex h-[calc(100vh-4rem)] overflow-hidden">
	<!-- Left Sidebar -->
	{#if showSidebar}
		<aside class="w-80 border-r bg-background flex flex-col">
			<!-- Sidebar Header -->
			<div class="p-4 border-b">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center space-x-2">
						<Sparkles class="h-5 w-5 text-primary" />
						<h2 class="font-semibold">AI Chat</h2>
					</div>
					<Button variant="ghost" size="sm" onclick={() => showSidebar = false}>
						<ChevronLeft class="h-4 w-4" />
					</Button>
				</div>

				<!-- New Chat Button -->
				<Button onclick={startNewChat} class="w-full">
					<Plus class="h-4 w-4 mr-2" />
					New Chat
				</Button>
			</div>

			<!-- Sidebar Tabs -->
			<div class="flex border-b">
				<button 
					class="flex-1 p-2 text-sm border-b-2 {sidebarTab === 'conversations' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}"
					onclick={() => sidebarTab = 'conversations'}
				>
					<MessageSquare class="h-4 w-4 mx-auto mb-1" />
					Chats
				</button>
				<button 
					class="flex-1 p-2 text-sm border-b-2 {sidebarTab === 'prompts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}"
					onclick={() => sidebarTab = 'prompts'}
				>
					<Code class="h-4 w-4 mx-auto mb-1" />
					Prompts
				</button>
				<button 
					class="flex-1 p-2 text-sm border-b-2 {sidebarTab === 'outputs' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}"
					onclick={() => sidebarTab = 'outputs'}
				>
					<Braces class="h-4 w-4 mx-auto mb-1" />
					Schemas
				</button>
			</div>

			<!-- Sidebar Content -->
			<div class="flex-1 overflow-y-auto">
				{#if sidebarTab === 'conversations'}
					<!-- Conversations Tab -->
					<div class="p-4">
						<div class="relative mb-4">
							<Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								bind:value={searchQuery}
								placeholder="Search conversations..."
								class="pl-10"
							/>
						</div>

						<div class="space-y-2">
							{#each filteredConversations as conversation (conversation.id)}
								<Card.Root 
									class="p-3 cursor-pointer hover:bg-muted transition-colors {currentChatId === conversation.id ? 'bg-muted border-primary' : ''}"
									onclick={() => loadConversation(conversation)}
								>
									<div class="flex items-start justify-between">
										<div class="flex-1 min-w-0">
											<h4 class="font-medium text-sm truncate">{conversation.title}</h4>
											<p class="text-xs text-muted-foreground">
												{conversation.message_count} messages • {new Date(conversation.updated_at).toLocaleDateString()}
											</p>
										</div>
										{#if conversation.is_pinned}
											<Pin class="h-3 w-3 text-primary ml-2 flex-shrink-0" />
										{/if}
									</div>
								</Card.Root>
							{/each}
						</div>
					</div>
				{:else if sidebarTab === 'prompts'}
					<!-- System Prompts Tab -->
					<div class="p-4 space-y-3">
						{#if selectedSystemPrompt}
							<div class="p-3 bg-primary/10 border border-primary/20 rounded-md">
								<div class="flex items-center justify-between mb-2">
									<span class="text-sm font-medium text-primary">Active Prompt</span>
									<Button variant="ghost" size="sm" onclick={() => selectedSystemPrompt = null}>
										<X class="h-3 w-3" />
									</Button>
								</div>
								<p class="text-sm font-medium">{selectedSystemPrompt.name}</p>
								<p class="text-xs text-muted-foreground">v{selectedSystemPrompt.version}</p>
							</div>
						{/if}

						{#each systemPrompts as prompt (prompt.id)}
							<Card.Root 
								class="p-3 cursor-pointer hover:bg-muted transition-colors {selectedSystemPrompt?.id === prompt.id ? 'bg-muted border-primary' : ''}"
								onclick={() => selectSystemPrompt(prompt)}
							>
								<div class="flex items-start justify-between">
									<div class="flex-1 min-w-0">
										<h4 class="font-medium text-sm truncate">{prompt.name}</h4>
										{#if prompt.description}
											<p class="text-xs text-muted-foreground truncate">{prompt.description}</p>
										{/if}
										<div class="flex items-center space-x-2 mt-1">
											<Badge variant="outline" class="text-xs">v{prompt.version}</Badge>
											<Badge variant="outline" class="text-xs">{prompt.category}</Badge>
											{#if prompt.is_public}
												<Globe class="h-3 w-3 text-muted-foreground" />
											{:else}
												<Lock class="h-3 w-3 text-muted-foreground" />
											{/if}
										</div>
									</div>
								</div>
							</Card.Root>
						{/each}
					</div>
				{:else if sidebarTab === 'outputs'}
					<!-- Structured Outputs Tab -->
					<div class="p-4 space-y-3">
						<div class="flex items-center space-x-2 mb-4">
							<Switch bind:checked={useStructuredOutput} />
							<Label class="text-sm">Enable Structured Output</Label>
						</div>

						{#if useStructuredOutput && selectedStructuredOutput}
							<div class="p-3 bg-primary/10 border border-primary/20 rounded-md">
								<div class="flex items-center justify-between mb-2">
									<span class="text-sm font-medium text-primary">Active Schema</span>
									<Button variant="ghost" size="sm" onclick={() => selectedStructuredOutput = null}>
										<X class="h-3 w-3" />
									</Button>
								</div>
								<p class="text-sm font-medium">{selectedStructuredOutput.name}</p>
								<p class="text-xs text-muted-foreground">v{selectedStructuredOutput.version}</p>
							</div>
						{/if}

						{#each structuredOutputs as output (output.id)}
							<Card.Root 
								class="p-3 cursor-pointer hover:bg-muted transition-colors {selectedStructuredOutput?.id === output.id ? 'bg-muted border-primary' : ''} {!useStructuredOutput ? 'opacity-50' : ''}"
								onclick={() => useStructuredOutput && selectStructuredOutput(output)}
							>
								<div class="flex items-start justify-between">
									<div class="flex-1 min-w-0">
										<h4 class="font-medium text-sm truncate">{output.name}</h4>
										{#if output.description}
											<p class="text-xs text-muted-foreground truncate">{output.description}</p>
										{/if}
										<div class="flex items-center space-x-2 mt-1">
											<Badge variant="outline" class="text-xs">v{output.version}</Badge>
											{#if output.is_public}
												<Globe class="h-3 w-3 text-muted-foreground" />
											{:else}
												<Lock class="h-3 w-3 text-muted-foreground" />
											{/if}
										</div>
									</div>
								</div>
							</Card.Root>
						{/each}
					</div>
				{/if}
			</div>
		</aside>
	{/if}

	<!-- Main Chat Area -->
	<main class="flex-1 flex flex-col">
		<!-- Header -->
		<div class="border-b p-4 flex items-center justify-between">
			<div class="flex items-center space-x-3">
				{#if !showSidebar}
					<Button variant="ghost" size="sm" onclick={() => showSidebar = true}>
						<ChevronRight class="h-4 w-4" />
					</Button>
				{/if}
				
				<div class="flex items-center space-x-2">
					<div class="bg-primary rounded-lg p-2">
						<Sparkles class="text-primary-foreground h-5 w-5" />
					</div>
					<div>
						<h1 class="text-lg font-bold">AI Chat</h1>
						<p class="text-sm text-muted-foreground">
							Powered by {selectedModel?.name || selectedModel?.id}
						</p>
					</div>
				</div>
			</div>

			<!-- Feature Indicators -->
			<div class="flex items-center space-x-2">
				{#if selectedSystemPrompt}
					<Badge variant="secondary" class="text-xs">
						<Code class="h-3 w-3 mr-1" />
						{selectedSystemPrompt.name}
					</Badge>
				{/if}
				{#if useStructuredOutput && selectedStructuredOutput}
					<Badge variant="secondary" class="text-xs">
						<Braces class="h-3 w-3 mr-1" />
						{selectedStructuredOutput.name}
					</Badge>
				{/if}
				{#if hasAttachments}
					<Badge variant="secondary" class="text-xs">
						<FileText class="h-3 w-3 mr-1" />
						{attachments.length} files
					</Badge>
				{/if}

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
			<div class="p-4">
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

		<!-- Messages Container -->
		<div bind:this={chatContainer} class="flex-1 overflow-y-auto p-4">
			{#if messages.length === 0}
				<!-- Welcome Screen -->
				<Card.Root class="flex h-full items-center justify-center">
					<Card.Content class="py-12 text-center">
						<div class="bg-primary mb-6 inline-flex items-center justify-center rounded-full p-4">
							<Sparkles class="text-primary-foreground h-8 w-8" />
						</div>
						<h2 class="mb-2 text-xl font-semibold">Welcome to Enhanced AI Chat</h2>
						<p class="text-muted-foreground mx-auto mb-6 max-w-md">
							Start a conversation with AI. Upload files, use system prompts, or enable structured outputs for advanced functionality.
						</p>
						<div class="flex flex-wrap justify-center gap-2">
							<Badge variant="outline">🖼️ Images</Badge>
							<Badge variant="outline">📄 PDFs</Badge>
							<Badge variant="outline">🎵 Audio</Badge>
							<Badge variant="outline">📝 System Prompts</Badge>
							<Badge variant="outline">🔧 Structured Output</Badge>
						</div>
					</Card.Content>
				</Card.Root>
			{:else}
				<!-- Messages List -->
				<div class="space-y-4 max-w-4xl mx-auto">
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
									{#if message.model && message.role === 'assistant'}
										<Badge variant="secondary" class="text-xs">
											{message.model}
										</Badge>
									{/if}
									<span class="text-muted-foreground text-xs">
										{formatTimestamp(message.timestamp)}
									</span>
								</div>

								<!-- Attachments -->
								{#if message.attachments && message.attachments.length > 0}
									<div class="mb-3 flex flex-wrap gap-2">
										{#each message.attachments as attachment}
											{@const IconComponent = getFileIcon(attachment.type)}
											<div class="flex items-center space-x-2 bg-muted rounded-md p-2">
												<IconComponent class="h-4 w-4 text-muted-foreground" />
												<span class="text-xs">{attachment.name}</span>
												<span class="text-xs text-muted-foreground">({formatFileSize(attachment.size)})</span>
											</div>
										{/each}
									</div>
								{/if}

								<Card.Root>
									<Card.Content class="p-3">
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
									<Card.Content class="p-3">
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

		<!-- File Attachments Display -->
		{#if attachments.length > 0}
			<div class="border-t p-4">
				<div class="flex flex-wrap gap-2 max-w-4xl mx-auto">
					{#each attachments as attachment}
						{@const IconComponent = getFileIcon(attachment.type)}
						<div class="flex items-center space-x-2 bg-muted rounded-md p-2">
							<IconComponent class="h-4 w-4 text-muted-foreground" />
							<span class="text-sm">{attachment.name}</span>
							<span class="text-xs text-muted-foreground">({formatFileSize(attachment.size)})</span>
							<Button variant="ghost" size="sm" onclick={() => removeAttachment(attachment.id)}>
								<X class="h-3 w-3" />
							</Button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Input Area -->
		<div class="border-t p-4">
			<div class="max-w-4xl mx-auto">
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
					<div class="flex flex-col space-y-2">
						<Button
							variant="outline"
							size="sm"
							onclick={() => fileInput?.click()}
							disabled={isLoading}
						>
							<Upload class="h-4 w-4" />
						</Button>
						<Button
							onclick={sendMessage}
							disabled={!currentMessage.trim() || isLoading}
							size="default"
						>
							<Send class="h-4 w-4" />
						</Button>
					</div>
				</div>

				<p class="text-muted-foreground mt-2 text-center text-sm">
					Press Enter to send, Shift+Enter for new line • Drag & drop files to upload
				</p>
			</div>
		</div>
	</main>
</div>

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
				<Select.Root type="single" name="model" bind:value={selectedModelId}>
					<Select.Trigger class="w-full">
						{triggerContent()}
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