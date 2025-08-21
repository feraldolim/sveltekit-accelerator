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
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
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
		History,
		Star,
		StarOff,
		Terminal,
		ExternalLink,
		Pencil,
		MessageCircle,
		List,
		Trash2,
		Link,
		ExternalLinkIcon
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	interface TokenUsage {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
		estimated_cost?: number;
	}

	interface Message {
		id: string;
		role: 'user' | 'assistant' | 'system';
		content: string;
		timestamp: Date;
		model?: string;
		attachments?: Attachment[];
		usage?: TokenUsage;
		provider?: string;
	}

	interface Attachment {
		id: string;
		type: 'image' | 'pdf' | 'audio' | 'text';
		name: string;
		size: number;
		data: string; // Base64 data URI or direct URL
		url?: string;
		isUrl?: boolean; // Flag to indicate if data is a URL
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
		default_system_prompt_id?: string;
		default_structured_output_id?: string;
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
	let showRightPanel = $state(true);
	let copiedMessageId: string | null = $state(null);
	let sidebarTab = $state<'prompts' | 'outputs' | 'conversations'>('conversations');

	// Chat configuration
	let temperature = $state(0.7);
	let maxCompletionTokens = $state(1000);
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
	let modelSearchQuery = $state('');
	let showModelDropdown = $state(false);
	let isDragOver = $state(false);
	let showFavoritesOnly = $state(false);
	let favoriteModelIds = $state(new Set<string>());
	let modalityFilter = $state<'all' | 'text' | 'image' | 'audio' | 'file'>('all');
	let showDeveloperTools = $state(false);
	let copiedCurl = $state(false);
	let editingConversationId = $state<string | null>(null);
	let showUrlDialog = $state(false);
	let urlInput = $state('');
	let urlFileType = $state<'image' | 'pdf'>('image');
	let editingModel = $state('');

	// Data from server
	const availableModels = $derived((data.models || []) as any[]);
	const systemPrompts = $derived((data.systemPrompts || []) as SystemPrompt[]);
	const structuredOutputs = $derived((data.structuredOutputs || []) as StructuredOutput[]);
	const favoriteModels = $derived((data.favoriteModels || []) as any[]);
	const defaultModel = $derived(data.defaultModel as any);
	
	// Conversations state - reactive to both server data and new chats
	let conversations = $state((data.chats || []) as Conversation[]);

	// Computed values
	const triggerContent = $derived(() => {
		const model = availableModels.find(m => m.id === selectedModelId);
		return model?.name || model?.id || "Select model";
	});
	const selectedModelData = $derived(() => {
		return availableModels.find(m => m.id === selectedModelId) as any;
	});
	const maxCompletionTokensLimit = $derived(() => {
		const model = selectedModelData();
		return model?.capabilities?.max_completion_tokens || model?.top_provider?.max_completion_tokens || 4000;
	});
	const hasAttachments = $derived(attachments.length > 0);

	// Filter conversations based on search
	const filteredConversations = $derived(
		searchQuery 
			? conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
			: conversations
	);

	// Filter models based on search, favorites, and modality
	const filteredModels = $derived(() => {
		let models = availableModels;
		
		// Filter by favorites if toggle is enabled
		if (showFavoritesOnly) {
			models = models.filter(model => favoriteModelIds.has(model.id));
		}
		
		// Filter by modality
		if (modalityFilter !== 'all') {
			models = models.filter(model => {
				const capabilities = model.capabilities;
				if (!capabilities || !capabilities.input_modalities) return false;
				
				const inputModalities = capabilities.input_modalities || [];
				switch (modalityFilter) {
					case 'text':
						return inputModalities.includes('text');
					case 'image':
						return inputModalities.includes('image');
					case 'audio':
						return inputModalities.includes('audio');
					case 'file':
						return inputModalities.includes('file');
					default:
						return true;
				}
			});
		}
		
		// Filter by search query
		if (modelSearchQuery) {
			const query = modelSearchQuery.toLowerCase();
			models = models.filter(model => 
				model.id?.toLowerCase().includes(query) || 
				model.name?.toLowerCase().includes(query)
			);
		}
		
		return models;
	});

	// Configure marked for better rendering
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	let chatContainer: HTMLElement;
	let messageInput: any;
	let fileInput: HTMLInputElement;

	onMount(() => {
		// Initialize favorite model IDs set
		favoriteModelIds = new Set(favoriteModels.map((fm: any) => fm.model_id));
		
		// Set default model - prefer user's default, then fallback to configured default
		if (!selectedModel && availableModels.length > 0) {
			const userDefaultModelId = defaultModel?.model_id;
			if (userDefaultModelId) {
				selectedModelId = userDefaultModelId;
				selectedModel = availableModels.find(m => m.id === userDefaultModelId) || availableModels[0];
			} else {
				selectedModel = availableModels.find(m => m.id === selectedModelId) || availableModels[0];
				selectedModelId = selectedModel?.id || availableModels[0].id;
			}
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

		// Close model dropdown when clicking outside
		const handleClickOutside = (e: Event) => {
			const target = e.target as HTMLElement;
			if (!target.closest('.model-dropdown')) {
				showModelDropdown = false;
				modelSearchQuery = '';
			}
		};
		document.addEventListener('click', handleClickOutside);

		return () => {
			document.removeEventListener('dragover', handleDragOver);
			document.removeEventListener('drop', handleDrop);
			document.removeEventListener('dragleave', handleDragLeave);
			document.removeEventListener('click', handleClickOutside);
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

	// Auto-adjust maxCompletionTokens when model changes
	$effect(() => {
		if (selectedModelId && availableModels.length > 0) {
			const modelLimit = maxCompletionTokensLimit();
			// Keep current value if it's within the new limit, otherwise reset to a reasonable default
			if (maxCompletionTokens > modelLimit) {
				maxCompletionTokens = Math.min(1000, modelLimit);
			}
		}
	});

	// Auto-select appropriate model when toggling favorites filter
	$effect(() => {
		if (showFavoritesOnly && availableModels.length > 0) {
			// If favorites only is enabled and current model is not in favorites, switch to first favorite or default
			if (!favoriteModelIds.has(selectedModelId)) {
				const favoriteModels = availableModels.filter(model => favoriteModelIds.has(model.id));
				if (favoriteModels.length > 0) {
					// Prefer the user's default model if it's in favorites
					const userDefault = favoriteModels.find(model => defaultModel?.model_id === model.id);
					const modelToSelect = userDefault || favoriteModels[0];
					selectedModelId = modelToSelect.id;
					toast.success(`Switched to favorited model: ${modelToSelect.name || modelToSelect.id}`);
				} else {
					// No favorites available, show warning and turn off favorites filter
					showFavoritesOnly = false;
					toast.error('No favorite models found. Add some models to favorites first.');
				}
			}
		}
	});

	// Update conversation model when model selection changes
	$effect(() => {
		if (currentChatId && selectedModelId) {
			updateConversationModel(currentChatId, selectedModelId);
		}
	});

	async function updateConversationModel(chatId: string, modelId: string) {
		try {
			const response = await fetch(`/api/chats/${chatId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ model: modelId })
			});

			if (!response.ok) {
				console.warn('Failed to update conversation model');
				return;
			}

			// Update the conversation in the local list
			const conversationIndex = conversations.findIndex(c => c.id === chatId);
			if (conversationIndex !== -1) {
				conversations[conversationIndex] = {
					...conversations[conversationIndex],
					model: modelId
				};
				conversations = [...conversations];
			}
		} catch (error) {
			console.warn('Failed to update conversation model:', error);
		}
	}

	function openEditConversation(conversation: Conversation, event: Event) {
		event.stopPropagation(); // Prevent conversation selection
		editingConversationId = conversation.id;
		editingModel = conversation.model;
	}

	async function saveConversationModel(conversationId: string, newModelId: string) {
		try {
			await updateConversationModel(conversationId, newModelId);
			
			// If this is the current conversation, update the selected model too
			if (currentChatId === conversationId) {
				selectedModelId = newModelId;
				selectedModel = availableModels.find(m => m.id === newModelId) || availableModels[0];
			}
			
			editingConversationId = null;
			toast.success('Conversation model updated');
		} catch (error) {
			toast.error('Failed to update conversation model');
		}
	}

	async function deleteConversation(conversationId: string, event: Event) {
		event.stopPropagation(); // Prevent conversation selection
		
		// Get conversation title for confirmation
		const conversation = conversations.find(c => c.id === conversationId);
		const title = conversation?.title || 'this conversation';
		
		// Show confirmation dialog
		if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
			return;
		}
		
		try {
			const response = await fetch(`/api/chats/${conversationId}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error('Failed to delete conversation');
			}

			// Remove from conversations list
			conversations = conversations.filter(c => c.id !== conversationId);
			
			// If this was the current conversation, clear it
			if (currentChatId === conversationId) {
				currentChatId = null;
				messages = [];
			}

			toast.success('Conversation deleted successfully');
		} catch (error) {
			console.error('Error deleting conversation:', error);
			toast.error('Failed to delete conversation');
		}
	}

	// Favorite models functions
	async function toggleFavoriteModel(modelId: string) {
		try {
			const isFavorited = favoriteModelIds.has(modelId);
			
			if (isFavorited) {
				// Remove from favorites
				const response = await fetch('/api/favorite-models', {
					method: 'DELETE',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ modelId })
				});

				if (!response.ok) throw new Error('Failed to remove favorite');
				
				favoriteModelIds.delete(modelId);
				favoriteModelIds = new Set(favoriteModelIds);
				toast.success('Removed from favorites');
			} else {
				// Add to favorites
				const response = await fetch('/api/favorite-models', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ modelId })
				});

				if (!response.ok) throw new Error('Failed to add favorite');
				
				favoriteModelIds.add(modelId);
				favoriteModelIds = new Set(favoriteModelIds);
				toast.success('Added to favorites');
			}
		} catch (error) {
			console.error('Error toggling favorite:', error);
			toast.error('Failed to update favorites');
		}
	}

	// Generate cURL command for current chat state
	const generateCurlCommand = $derived(() => {
		const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
		
		// Build messages array including current input if it exists
		const allMessages = [...messages];
		if (currentMessage.trim()) {
			allMessages.push({
				role: 'user',
				content: currentMessage.trim(),
				id: 'temp-input',
				timestamp: new Date(),
				attachments: attachments.length > 0 ? attachments : undefined
			});
		}
		
		// Convert messages to API format with multimodal support
		const apiMessages = allMessages.map((msg) => {
			const baseMessage = {
				role: msg.role,
				content: msg.content
			};

			// Handle multimodal content for user messages with attachments
			if (msg.role === 'user' && msg.attachments && msg.attachments.length > 0) {
				const contentArray: any[] = [
					{ type: 'text', text: msg.content }
				];

				// Add each attachment in the correct format
				msg.attachments.forEach(attachment => {
					if (attachment.type === 'image' && attachment.data) {
						if (attachment.isUrl) {
							// For URL images, pass the URL directly
							contentArray.push({
								type: 'image_url',
								image_url: {
									url: attachment.data, // Direct URL
									detail: 'high'
								}
							});
						} else {
							// For base64 images
							contentArray.push({
								type: 'image_url',
								image_url: {
									url: attachment.data, // Base64 data URI
									detail: 'high'
								}
							});
						}
					} else if (attachment.type === 'pdf' && attachment.data) {
						if (attachment.isUrl) {
							// For URL PDFs, pass the URL as file_data
							contentArray.push({
								type: 'file',
								file: {
									filename: attachment.name,
									file_data: attachment.data // Direct URL
								}
							});
						} else {
							// For base64 PDFs
							contentArray.push({
								type: 'file',
								file: {
									filename: attachment.name,
									file_data: attachment.data // Base64 data URI
								}
							});
						}
					} else if (attachment.type === 'audio' && attachment.data) {
						// Audio URLs are not supported by OpenRouter, only base64
						if (!attachment.isUrl) {
							const audioFormat = attachment.name.toLowerCase().includes('.wav') ? 'wav' : 'mp3';
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
				});

				return {
					...baseMessage,
					content: contentArray
				};
			}

			return baseMessage;
		});
		
		// Prepare the request body
		const requestBody = {
			messages: apiMessages,
			model: selectedModelId || 'moonshotai/kimi-k2:free',
			temperature,
			max_completion_tokens: maxCompletionTokens,
			stream: streamResponse,
			...(selectedSystemPrompt?.id && { system_prompt_id: selectedSystemPrompt.id }),
			...(selectedStructuredOutput?.id && { structured_output_id: selectedStructuredOutput.id })
		};

		// Headers for API key authentication
		const headers = [
			'Content-Type: application/json',
			'Authorization: Bearer YOUR_API_KEY_HERE'
		];

		if (userApiKey) {
			headers.push(`x-openrouter-api-key: ${userApiKey}`);
		}

		// Build cURL command using v1 API
		const curlHeaders = headers.map(h => `  -H "${h}"`).join(' \\\n');
		const curlBody = JSON.stringify(requestBody, null, 2)
			.replace(/"/g, '\\"')
			.split('\n')
			.map(line => `    ${line}`)
			.join('\n');

		return `curl -X POST "${baseUrl}/api/v1/chat/completions" \\\n${curlHeaders} \\\n  -d "\n${curlBody}\n"`;
	});

	// Generate display version with censored API key
	const displayCurlCommand = $derived(() => {
		if (!userApiKey) return generateCurlCommand();
		
		// Censor the API key in the display version
		const fullCommand = generateCurlCommand();
		const censoredKey = userApiKey.substring(0, 12) + '••••••••••••••••••••••••••••••••••••••••••••••••••••';
		return fullCommand.replace(userApiKey, censoredKey);
	});

	// Copy cURL command to clipboard (uses full uncensored command)
	async function copyCurlCommand() {
		try {
			await navigator.clipboard.writeText(generateCurlCommand());
			copiedCurl = true;
			toast.success('cURL command copied to clipboard');
			setTimeout(() => copiedCurl = false, 2000);
		} catch (error) {
			toast.error('Failed to copy cURL command');
		}
	}

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

	// URL validation and processing
	function validateUrl(url: string): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	function detectFileTypeFromUrl(url: string): 'image' | 'pdf' | null {
		const lowercaseUrl = url.toLowerCase();
		
		// Check for common image extensions
		if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(lowercaseUrl)) {
			return 'image';
		}
		
		// Check for PDF extension
		if (/\.pdf(\?|$)/i.test(lowercaseUrl)) {
			return 'pdf';
		}
		
		return null;
	}

	function getFileNameFromUrl(url: string): string {
		try {
			const urlObj = new URL(url);
			const pathname = urlObj.pathname;
			const filename = pathname.split('/').pop() || 'file';
			return filename.includes('.') ? filename : `${filename}.${urlFileType}`;
		} catch {
			return `file.${urlFileType}`;
		}
	}

	async function handleUrlSubmit() {
		if (!urlInput.trim()) {
			toast.error('Please enter a URL');
			return;
		}

		if (!validateUrl(urlInput.trim())) {
			toast.error('Please enter a valid URL');
			return;
		}

		const url = urlInput.trim();
		
		// Warn about common placeholder URLs
		if (url.includes('example.com') || url.includes('placeholder') || url.includes('dummy')) {
			toast.error('Please use a real, publicly accessible URL. Example URLs like "example.com" won\'t work.');
			return;
		}
		
		const detectedType = detectFileTypeFromUrl(url);
		const finalType = detectedType || urlFileType;

		// Audio is not supported via URL according to OpenRouter docs
		// This check is here for future-proofing in case we add audio URL detection

		const attachment: Attachment = {
			id: crypto.randomUUID(),
			type: finalType,
			name: getFileNameFromUrl(url),
			size: 0, // Unknown for URLs
			data: url,
			isUrl: true
		};

		attachments = [...attachments, attachment];
		toast.success(`Added ${attachment.name} from URL. Note: The AI will attempt to fetch this file when processing your message.`);
		
		// Reset dialog
		urlInput = '';
		urlFileType = 'image';
		showUrlDialog = false;
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
			max_tokens: maxCompletionTokens, // OpenRouter API uses max_tokens
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
								
								// Check for errors first
								if (parsed.error) {
									console.error('Stream error received:', parsed.error);
									
									// Provide more helpful error messages for common issues
									let errorMessage = parsed.error.message;
									if (errorMessage.includes('Invalid file URL') || errorMessage.includes('Failed to parse')) {
										errorMessage = 'The file URL could not be accessed or processed. Please ensure the URL is publicly accessible and points to a valid file.';
									}
									
									toast.error(`AI Error: ${errorMessage}`);
									
									// Update the assistant message with error
									messages = messages.map((msg) =>
										msg.id === assistantMessage.id
											? { ...msg, content: `Error: ${errorMessage}` }
											: msg
									);
									
									// Handle chat_id if present
									if (parsed.chat_id && !currentChatId) {
										currentChatId = parsed.chat_id;
										updateConversationsList(parsed.chat_id);
									}
									
									return; // Exit early on error
								}
								
								// Handle chat_id from response
								if (parsed.chat_id && !currentChatId) {
									currentChatId = parsed.chat_id;
									// Update conversations list with the new chat
									updateConversationsList(parsed.chat_id);
								}

								const content = parsed.choices?.[0]?.delta?.content || '';

								if (content) {
									messages = messages.map((msg) =>
										msg.id === assistantMessage.id
											? { ...msg, content: msg.content + content }
											: msg
									);
								}

								// Update model and provider info when available
								if (parsed.model || parsed.provider) {
									messages = messages.map((msg) =>
										msg.id === assistantMessage.id
											? { 
												...msg, 
												model: parsed.model || msg.model,
												provider: parsed.provider || msg.provider
											}
											: msg
									);
								}

								// Handle usage info if provided (usually at the end of stream)
								if (parsed.usage) {
									messages = messages.map((msg) =>
										msg.id === assistantMessage.id
											? { ...msg, usage: parsed.usage }
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
			max_tokens: maxCompletionTokens, // OpenRouter API uses max_tokens
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
			model: result.model || selectedModel?.id || 'moonshotai/kimi-k2:free',
			provider: result.provider,
			usage: result.usage
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

	function formatTokenUsage(usage?: TokenUsage): string {
		if (!usage?.total_tokens) return '';
		return `${usage.total_tokens.toLocaleString()} tokens`;
	}

	function formatTokenUsageTooltip(usage?: TokenUsage): string {
		if (!usage) return '';
		const parts = [];
		if (usage.prompt_tokens) parts.push(`Prompt: ${usage.prompt_tokens.toLocaleString()}`);
		if (usage.completion_tokens) parts.push(`Completion: ${usage.completion_tokens.toLocaleString()}`);
		if (usage.total_tokens) parts.push(`Total: ${usage.total_tokens.toLocaleString()}`);
		if (usage.estimated_cost) parts.push(`Est. Cost: $${usage.estimated_cost.toFixed(6)}`);
		return parts.join('\n');
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
			
			// Associate files with their respective messages
			if (data.files && data.files.length > 0) {
				const filesByMessage = new Map<string, Attachment[]>();
				
				// Group files by message_id
				data.files.forEach((file: any) => {
					if (file.message_id) {
						if (!filesByMessage.has(file.message_id)) {
							filesByMessage.set(file.message_id, []);
						}
						
						// Convert database file record to Attachment format
						const attachment: Attachment = {
							id: file.id,
							type: file.file_type as 'image' | 'pdf' | 'audio' | 'text',
							name: file.original_name || file.filename || 'Unknown file',
							size: file.file_size || 0,
							data: '', // We don't store the actual file data for display
							url: file.file_path
						};
						
						filesByMessage.get(file.message_id)!.push(attachment);
					}
				});
				
				// Add attachments to their respective messages
				messages = messages.map(message => ({
					...message,
					attachments: filesByMessage.get(message.id) || message.attachments || []
				}));
			}
			
			// Update chat metadata if available
			if (data.chat.default_system_prompt_id) {
				const systemPrompt = systemPrompts.find(p => p.id === data.chat.default_system_prompt_id);
				if (systemPrompt) {
					selectedSystemPrompt = systemPrompt;
					toast.success(`System prompt activated: ${systemPrompt.name}`);
				}
			} else {
				selectedSystemPrompt = null;
			}
			
			if (data.chat.default_structured_output_id) {
				const structuredOutput = structuredOutputs.find(s => s.id === data.chat.default_structured_output_id);
				if (structuredOutput) {
					selectedStructuredOutput = structuredOutput;
					useStructuredOutput = true;
					toast.success(`Structured output activated: ${structuredOutput.name}`);
				}
			} else {
				selectedStructuredOutput = null;
				useStructuredOutput = false;
			}
			
			if (data.chat.model) {
				selectedModelId = data.chat.model;
				selectedModel = availableModels.find(m => m.id === data.chat.model) || availableModels[0];
				toast.success(`Model switched to: ${selectedModel?.name || data.chat.model}`);
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

						<Tooltip.Provider>
						<div class="space-y-2">
							{#each filteredConversations as conversation (conversation.id)}
								<Card.Root 
									class="p-3 cursor-pointer hover:bg-muted transition-colors {currentChatId === conversation.id ? 'bg-muted border-primary' : ''}"
									onclick={() => loadConversation(conversation)}
								>
									<div class="flex items-start justify-between">
										<div class="flex-1 min-w-0">
											<div class="flex items-center justify-between mb-1">
												<h4 class="font-medium text-sm truncate flex-1">{conversation.title}</h4>
												<div class="flex items-center space-x-1 ml-2">
													<!-- System Prompt Icon -->
													{#if conversation.default_system_prompt_id}
														<Tooltip.Root>
															<Tooltip.Trigger>
																<MessageCircle class="h-3 w-3 text-blue-500" />
															</Tooltip.Trigger>
															<Tooltip.Content>
																<p class="text-xs">
																	System Prompt: {systemPrompts.find(p => p.id === conversation.default_system_prompt_id)?.name || 'Unknown'}
																</p>
															</Tooltip.Content>
														</Tooltip.Root>
													{/if}
													
													<!-- Structured Output Icon -->
													{#if conversation.default_structured_output_id}
														<Tooltip.Root>
															<Tooltip.Trigger>
																<List class="h-3 w-3 text-green-500" />
															</Tooltip.Trigger>
															<Tooltip.Content>
																<p class="text-xs">
																	Schema: {structuredOutputs.find(s => s.id === conversation.default_structured_output_id)?.name || 'Unknown'}
																</p>
															</Tooltip.Content>
														</Tooltip.Root>
													{/if}
													
													<!-- Edit Button -->
													<Popover.Root open={editingConversationId === conversation.id} onOpenChange={(open) => {
														if (!open) editingConversationId = null;
													}}>
														<Popover.Trigger>
															<Button 
																variant="ghost" 
																size="sm" 
																class="h-5 w-5 p-0 hover:bg-muted-foreground/20"
																onclick={(e) => openEditConversation(conversation, e)}
															>
																<Pencil class="h-3 w-3" />
															</Button>
														</Popover.Trigger>
														<Popover.Content class="w-80">
															<div class="space-y-3">
																<h4 class="font-medium text-sm">Edit Conversation</h4>
																<div class="space-y-2">
																	<Label class="text-xs">Model</Label>
																	<select 
																		bind:value={editingModel}
																		class="w-full h-8 px-2 rounded border border-border bg-background text-sm"
																	>
																		{#each availableModels as model}
																			<option value={model.id}>
																				{model.name || model.id}
																			</option>
																		{/each}
																	</select>
																</div>
																<div class="flex justify-end space-x-2">
																	<Button 
																		variant="outline" 
																		size="sm" 
																		onclick={() => editingConversationId = null}
																	>
																		Cancel
																	</Button>
																	<Button 
																		size="sm" 
																		onclick={() => saveConversationModel(conversation.id, editingModel)}
																	>
																		Save
																	</Button>
																</div>
															</div>
														</Popover.Content>
													</Popover.Root>

													<!-- Delete Button -->
													<Button 
														variant="ghost" 
														size="sm" 
														class="h-5 w-5 p-0 hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
														onclick={(e) => deleteConversation(conversation.id, e)}
													>
														<Trash2 class="h-3 w-3" />
													</Button>
													
													{#if conversation.is_pinned}
														<Pin class="h-3 w-3 text-primary" />
													{/if}
												</div>
											</div>
											
											<div class="flex items-center space-x-2 mt-1">
												<Badge variant="outline" class="text-xs h-4 px-1">
													{availableModels.find(m => m.id === conversation.model)?.name || conversation.model}
												</Badge>
												<span class="text-xs text-muted-foreground">
													{conversation.message_count} messages • {new Date(conversation.updated_at).toLocaleDateString()}
												</span>
											</div>
										</div>
									</div>
								</Card.Root>
							{/each}
						</div>
						</Tooltip.Provider>
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
						<h2 class="mb-2 text-xl font-semibold">Welcome to SKA AI Chat</h2>
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
								<div class="mb-2 flex items-center space-x-2 flex-wrap">
									<span class="text-sm font-medium">
										{message.role === 'user' ? 'You' : 'AI Assistant'}
									</span>
									{#if message.model && message.role === 'assistant'}
										<Badge variant="secondary" class="text-xs">
											{message.model}
										</Badge>
									{/if}
									{#if message.provider && message.role === 'assistant'}
										<Badge variant="outline" class="text-xs">
											{message.provider}
										</Badge>
									{/if}
									{#if message.usage && message.role === 'assistant'}
										<Badge 
											variant="outline" 
											class="text-xs cursor-help hover:bg-muted" 
											title={formatTokenUsageTooltip(message.usage)}
										>
											{formatTokenUsage(message.usage)}
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
												<div class="flex items-center space-x-1">
													<IconComponent class="h-4 w-4 text-muted-foreground" />
													{#if attachment.isUrl}
														<ExternalLink class="h-3 w-3 text-blue-500" />
													{/if}
												</div>
												<span class="text-xs">{attachment.name}</span>
												<span class="text-xs text-muted-foreground">
													{#if attachment.isUrl}
														(URL)
													{:else}
														({formatFileSize(attachment.size)})
													{/if}
												</span>
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
							<div class="flex items-center space-x-1">
								<IconComponent class="h-4 w-4 text-muted-foreground" />
								{#if attachment.isUrl}
									<ExternalLink class="h-3 w-3 text-blue-500" />
								{/if}
							</div>
							<span class="text-sm">{attachment.name}</span>
							<span class="text-xs text-muted-foreground">
								{#if attachment.isUrl}
									(URL)
								{:else}
									({formatFileSize(attachment.size)})
								{/if}
							</span>
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
							variant="outline"
							size="sm"
							onclick={() => showUrlDialog = true}
							disabled={isLoading}
						>
							<Link class="h-4 w-4" />
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

	<!-- Right Settings Panel -->
	{#if showRightPanel}
		<aside class="w-80 border-l bg-background flex flex-col">
			<!-- Panel Header -->
			<div class="p-4 border-b">
				<div class="flex items-center justify-between">
					<h3 class="font-semibold">Quick Settings</h3>
					<Button variant="ghost" size="sm" onclick={() => showRightPanel = false}>
						<ChevronRight class="h-4 w-4" />
					</Button>
				</div>
			</div>

			<!-- Settings Content -->
			<div class="flex-1 overflow-y-auto p-4 space-y-6">
				<!-- Model Selection -->
				<div class="space-y-3">
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<Label class="text-sm font-medium">Model</Label>
							<div class="flex items-center space-x-2">
								<Switch bind:checked={showFavoritesOnly} />
								<Label class="text-xs text-muted-foreground">Favorites Only</Label>
							</div>
						</div>
						
						<!-- Modality Filters -->
						<div class="flex flex-wrap gap-1">
							<button
								type="button"
								class="px-2 py-1 text-xs rounded-md transition-colors {modalityFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
								onclick={() => modalityFilter = 'all'}
							>
								All
							</button>
							<button
								type="button"
								class="px-2 py-1 text-xs rounded-md transition-colors {modalityFilter === 'text' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
								onclick={() => modalityFilter = 'text'}
							>
								📝 Text
							</button>
							<button
								type="button"
								class="px-2 py-1 text-xs rounded-md transition-colors {modalityFilter === 'image' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
								onclick={() => modalityFilter = 'image'}
							>
								📷 Image
							</button>
							<button
								type="button"
								class="px-2 py-1 text-xs rounded-md transition-colors {modalityFilter === 'audio' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
								onclick={() => modalityFilter = 'audio'}
							>
								🎵 Audio
							</button>
							<button
								type="button"
								class="px-2 py-1 text-xs rounded-md transition-colors {modalityFilter === 'file' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
								onclick={() => modalityFilter = 'file'}
							>
								📄 File
							</button>
						</div>
					</div>
					
					<!-- Custom Searchable Dropdown -->
					<div class="relative model-dropdown">
						<!-- Selected Model Display / Search Input -->
						<button
							type="button"
							class="flex items-center justify-between w-full px-3 py-2 text-sm border rounded-md cursor-pointer bg-background hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
							onclick={() => showModelDropdown = !showModelDropdown}
							aria-expanded={showModelDropdown}
							aria-haspopup="listbox"
						>
							{#if showModelDropdown}
								<input
									type="text"
									bind:value={modelSearchQuery}
									placeholder="Search models..."
									class="flex-1 bg-transparent outline-none"
									onclick={(e) => e.stopPropagation()}
								/>
							{:else}
								<span class="truncate">{triggerContent()}</span>
							{/if}
							<ChevronRight class="h-4 w-4 transform transition-transform {showModelDropdown ? 'rotate-90' : ''}" />
						</button>

						<!-- Dropdown List -->
						{#if showModelDropdown}
							<div class="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-[300px] overflow-y-auto" role="listbox">
								{#each filteredModels() as model (model.id)}
									<div class="flex items-center border-b border-border/50 last:border-b-0">
										<button
											type="button"
											class="flex-1 text-left px-3 py-2 hover:bg-muted cursor-pointer focus:outline-none focus:bg-muted"
											onclick={() => {
												selectedModelId = model.id;
												showModelDropdown = false;
												modelSearchQuery = '';
											}}
											role="option"
											aria-selected={selectedModelId === model.id}
										>
											<div class="flex flex-col items-start w-full">
												<div class="flex items-center justify-between w-full">
													<span class="font-medium text-sm">{model.name || model.id}</span>
													{#if defaultModel?.model_id === model.id}
														<Badge variant="outline" class="text-xs h-5">Default</Badge>
													{/if}
												</div>
												{#if model.capabilities}
													<div class="flex items-center flex-wrap gap-1 text-xs text-muted-foreground mt-1">
														<span>{model.capabilities.context_length?.toLocaleString() || 'N/A'} ctx</span>
														
														<!-- Input modality badges -->
														{#if model.capabilities.input_modalities}
															{#if model.capabilities.input_modalities.includes('text')}
																<Badge variant="outline" class="text-xs h-4">📝</Badge>
															{/if}
															{#if model.capabilities.input_modalities.includes('image')}
																<Badge variant="outline" class="text-xs h-4">📷</Badge>
															{/if}
															{#if model.capabilities.input_modalities.includes('audio')}
																<Badge variant="outline" class="text-xs h-4">🎵</Badge>
															{/if}
														{:else if model.capabilities.multimodal}
															<!-- Fallback for models using old multimodal flag -->
															<Badge variant="outline" class="text-xs h-4">📷</Badge>
														{/if}
														
														{#if model.pricing}
															<span>${(parseFloat(model.pricing.completion) * 1000).toFixed(3)}/1K</span>
														{/if}
													</div>
												{/if}
											</div>
										</button>
										<div class="flex items-center px-2">
											<button
												type="button"
												class="p-1 hover:bg-muted rounded focus:outline-none"
												onclick={(e) => {
													e.stopPropagation();
													toggleFavoriteModel(model.id);
												}}
												title={favoriteModelIds.has(model.id) ? 'Remove from favorites' : 'Add to favorites'}
											>
												{#if favoriteModelIds.has(model.id)}
													<Star class="h-4 w-4 fill-yellow-400 text-yellow-400" />
												{:else}
													<StarOff class="h-4 w-4 text-muted-foreground" />
												{/if}
											</button>
										</div>
									</div>
								{:else}
									<div class="px-3 py-2 text-sm text-muted-foreground">
										No models found matching "{modelSearchQuery}"
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Temperature -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<Label class="text-sm font-medium">Temperature</Label>
						<span class="text-sm text-muted-foreground">{temperature}</span>
					</div>
					<input 
						type="range" 
						min="0" 
						max="2" 
						step="0.1" 
						bind:value={temperature} 
						class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
					/>
					<p class="text-xs text-muted-foreground">Controls response randomness</p>
				</div>

				<!-- Max Response Tokens -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<Label class="text-sm font-medium">Max Tokens</Label>
						<span class="text-sm text-muted-foreground">{maxCompletionTokens.toLocaleString()}</span>
					</div>
					<input 
						type="range" 
						min="100" 
						max={maxCompletionTokensLimit()} 
						step="100" 
						bind:value={maxCompletionTokens} 
						class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
					/>
					<p class="text-xs text-muted-foreground">
						Limit: {maxCompletionTokensLimit().toLocaleString()}
					</p>
				</div>

				<!-- Stream Setting -->
				<div class="space-y-3">
					<div class="flex items-center space-x-2">
						<input type="checkbox" id="stream-setting" bind:checked={streamResponse} class="rounded" />
						<Label for="stream-setting" class="text-sm">Stream responses</Label>
					</div>
					<p class="text-xs text-muted-foreground">Real-time message streaming</p>
				</div>

				<!-- Developer Tools Section -->
				<Separator />
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center space-x-2">
							<Terminal class="h-4 w-4" />
							<Label class="text-sm font-medium">Developer Tools</Label>
						</div>
						<Button 
							variant="ghost" 
							size="sm" 
							onclick={() => showDeveloperTools = !showDeveloperTools}
							class="h-6 px-2"
						>
							<ChevronRight class="h-3 w-3 transition-transform {showDeveloperTools ? 'rotate-90' : ''}" />
						</Button>
					</div>

					{#if showDeveloperTools}
						<div class="space-y-3">
							<!-- Developer API Key Status -->
							<Alert.Root class="border-blue-200 bg-blue-50">
								<Key class="h-4 w-4" />
								<Alert.Title>Developer API Access</Alert.Title>
								<Alert.Description class="flex items-center justify-between">
									<span class="text-sm">Generate a developer API key for external access</span>
									<Button variant="outline" size="sm" onclick={() => window.open('/developer/keys', '_blank')} class="ml-2">
										<ExternalLink class="h-3 w-3 mr-1" />
										Manage Keys
									</Button>
								</Alert.Description>
							</Alert.Root>

							<!-- cURL Command -->
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<Label class="text-xs font-medium text-muted-foreground">cURL Command</Label>
									<Button 
										variant="ghost" 
										size="sm" 
										onclick={copyCurlCommand} 
										class="h-6 px-2"
										title="Copy cURL command"
									>
										{#if copiedCurl}
											<Check class="h-3 w-3" />
										{:else}
											<Copy class="h-3 w-3" />
										{/if}
									</Button>
								</div>
								
								<div class="relative">
									<pre class="bg-muted p-3 rounded-md text-xs overflow-auto max-w-full max-h-48"><code class="text-foreground font-mono">{displayCurlCommand()}</code></pre>
								</div>
								
								{#if messages.length === 0 && !currentMessage.trim()}
									<p class="text-xs text-muted-foreground">💡 Start typing or chatting to see the complete cURL command</p>
								{:else if currentMessage.trim()}
									<p class="text-xs text-muted-foreground">✨ Current input included in the cURL command</p>
								{/if}
								
								<div class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
									<p class="text-blue-800 font-medium">🔐 API Authentication:</p>
									<p class="text-blue-700">Replace <code>YOUR_API_KEY_HERE</code> with your developer API key from <a href="/developer/keys" target="_blank" class="underline">Developer Keys</a>. This uses the v1 API with proper API key authentication.</p>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</aside>
	{/if}

	<!-- Settings Toggle Button (when panel is closed) -->
	{#if !showRightPanel}
		<div class="fixed right-4 bottom-20 z-10">
			<div class="flex flex-col items-end space-y-2">
				<!-- Compact Settings Info -->
				<div class="bg-background border rounded-lg p-2 shadow-lg text-xs">
					<div class="text-muted-foreground">
						<div class="truncate max-w-32" title={selectedModel?.name || selectedModel?.id}>
							{selectedModel?.name || selectedModel?.id || 'No model'}
						</div>
						<div>T: {temperature} | Tokens: {maxCompletionTokens}</div>
					</div>
				</div>
				
				<!-- Toggle Button -->
				<Button 
					variant="outline" 
					size="sm" 
					onclick={() => showRightPanel = true}
					class="shadow-lg bg-background border-2"
					title="Open Settings Panel"
				>
					<Settings class="h-4 w-4" />
				</Button>
			</div>
		</div>
	{/if}
</div>

<!-- Settings Dialog -->
<Dialog.Root bind:open={showSettings}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Chat Settings</Dialog.Title>
			<Dialog.Description>Customize your chat experience</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="p-3 bg-muted/50 rounded-lg">
				<p class="text-sm text-muted-foreground mb-2">
					<strong>Quick Settings:</strong> Model, temperature, and max tokens are now available directly in the chat interface above for easier access.
				</p>
			</div>
			
			<div class="flex items-center space-x-2">
				<input type="checkbox" id="stream" bind:checked={streamResponse} class="rounded" />
				<Label for="stream">Stream responses</Label>
				<span class="text-xs text-muted-foreground ml-2">Enable real-time message streaming</span>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- URL Input Dialog -->
<Dialog.Root bind:open={showUrlDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add File from URL</Dialog.Title>
			<Dialog.Description>
				Enter a publicly accessible URL for an image or PDF file. The file must be available online for the AI to process it. Audio files are not supported via URL.
			</Dialog.Description>
		</Dialog.Header>
		
		<div class="space-y-4">
			<div>
				<Label for="url-input">URL</Label>
				<Input
					id="url-input"
					bind:value={urlInput}
					placeholder="https://picsum.photos/200/300.jpg"
					onkeydown={(e) => e.key === 'Enter' && handleUrlSubmit()}
				/>
				<p class="text-xs text-muted-foreground mt-1">
					Examples: https://picsum.photos/200/300.jpg or any publicly accessible PDF/image URL
				</p>
			</div>
			
			<div>
				<Label>File Type</Label>
				<div class="flex space-x-4 mt-2">
					<label class="flex items-center space-x-2">
						<input 
							type="radio" 
							bind:group={urlFileType} 
							value="image"
							class="w-4 h-4"
						/>
						<span>Image</span>
					</label>
					<label class="flex items-center space-x-2">
						<input 
							type="radio" 
							bind:group={urlFileType} 
							value="pdf"
							class="w-4 h-4"
						/>
						<span>PDF</span>
					</label>
				</div>
			</div>
		</div>
		
		<Dialog.Footer class="flex justify-end space-x-2">
			<Button variant="outline" onclick={() => showUrlDialog = false}>
				Cancel
			</Button>
			<Button onclick={handleUrlSubmit} disabled={!urlInput.trim()}>
				Add URL
			</Button>
		</Dialog.Footer>
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