<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { 
		MessageSquare, 
		Plus, 
		Search, 
		Trash2, 
		Eye,
		Calendar,
		Hash,
		User,
		Bot,
		ExternalLink
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let deleteConversationId = $state<string | null>(null);
	let isLoading = $state(false);
	let searchQuery = $state(data.filters.search || '');

	async function deleteConversation(conversationId: string) {
		isLoading = true;

		try {
			const response = await fetch(`/api/chat/${conversationId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete conversation');
			}

			deleteConversationId = null;
			
			// Refresh the page
			goto('/developer/conversations', { invalidateAll: true });
			
			toast.success('Conversation deleted successfully');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to delete conversation');
		} finally {
			isLoading = false;
		}
	}

	function applyFilters() {
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		
		goto(`/developer/conversations?${params.toString()}`, { invalidateAll: true });
	}

	function clearFilters() {
		searchQuery = '';
		goto('/developer/conversations', { invalidateAll: true });
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getRoleColor(role: string): string {
		switch (role) {
			case 'user': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
			case 'assistant': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
			case 'system': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
			default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
		}
	}

	function getRoleIcon(role: string) {
		switch (role) {
			case 'user': return User;
			case 'assistant': return Bot;
			default: return MessageSquare;
		}
	}

	function truncateText(text: string, maxLength: number = 150): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Conversations</h1>
			<p class="text-muted-foreground mt-1">
				View and manage all chat conversations and message history
			</p>
		</div>
		<Button href="/chat" class="flex items-center space-x-2">
			<Plus class="h-4 w-4" />
			<span>New Chat</span>
		</Button>
	</div>

	<!-- Filters -->
	<Card.Root>
		<Card.Content class="p-4">
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div class="md:col-span-2">
					<div class="relative">
						<Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							bind:value={searchQuery}
							placeholder="Search conversations..."
							class="pl-10"
							onkeydown={(e) => e.key === 'Enter' && applyFilters()}
						/>
					</div>
				</div>
				<div class="flex space-x-2 md:col-span-2">
					<Button onclick={applyFilters} size="sm">Search</Button>
					<Button onclick={clearFilters} variant="outline" size="sm">Clear</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Conversations List -->
	{#if data.conversations.length === 0}
		<Card.Root class="border-dashed">
			<Card.Content class="p-12 text-center">
				<MessageSquare class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
				<h3 class="text-lg font-semibold mb-2">
					{data.filters.search ? 'No conversations found' : 'No Conversations'}
				</h3>
				<p class="text-muted-foreground mb-6 max-w-sm mx-auto">
					{data.filters.search 
						? 'Try adjusting your search query'
						: 'Start your first conversation to see chat history and analytics here'
					}
				</p>
				{#if !data.filters.search}
					<Button href="/chat" size="lg">
						<Plus class="h-4 w-4 mr-2" />
						Start New Chat
					</Button>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="space-y-4">
			{#each data.conversations as conversation}
				<Card.Root class="hover:shadow-md transition-shadow">
					<Card.Content class="p-6">
						<div class="flex items-start justify-between">
							<div class="space-y-3 flex-1">
								<!-- Header -->
								<div class="flex items-center justify-between">
									<div class="space-y-1">
										<h3 class="font-semibold text-lg">
											{conversation.title || 'Untitled Conversation'}
										</h3>
										<div class="flex items-center space-x-4 text-sm text-muted-foreground">
											<div class="flex items-center space-x-1">
												<Calendar class="h-4 w-4" />
												<span>{formatDate(conversation.updated_at)}</span>
											</div>
											<div class="flex items-center space-x-1">
												<Hash class="h-4 w-4" />
												<span>{conversation.message_count} messages</span>
											</div>
										</div>
									</div>
									<div class="flex items-center space-x-2 ml-4">
										<Button 
											size="sm" 
											variant="outline"
											href="/chat/{conversation.id}"
										>
											<ExternalLink class="h-4 w-4 mr-2" />
											Open
										</Button>
										<Button 
											size="sm" 
											variant="outline"
											onclick={() => deleteConversationId = conversation.id}
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									</div>
								</div>

								<!-- Latest Message Preview -->
								{#if conversation.latest_message}
									{@const IconComponent = getRoleIcon(conversation.latest_message.role)}
									<div class="p-3 bg-muted rounded border-l-4 border-l-blue-500">
										<div class="flex items-center space-x-2 mb-2">
											<IconComponent class="h-4 w-4" />
											<Badge class={getRoleColor(conversation.latest_message.role)}>
												{conversation.latest_message.role}
											</Badge>
											<span class="text-xs text-muted-foreground">
												{formatDate(conversation.latest_message.created_at)}
											</span>
										</div>
										<p class="text-sm">
											{truncateText(conversation.latest_message.content)}
										</p>
									</div>
								{/if}

								<!-- Metadata -->
								<div class="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
									<span>ID: {conversation.id}</span>
									<span>Created: {formatDate(conversation.created_at)}</span>
								</div>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}

	<!-- Load More (Future Enhancement) -->
	{#if data.conversations.length >= 20}
		<div class="text-center pt-6">
			<Button variant="outline" size="lg">
				Load More Conversations
			</Button>
		</div>
	{/if}
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root open={deleteConversationId !== null}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Conversation</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete this conversation? This action cannot be undone and will permanently remove all messages in this chat.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => deleteConversationId = null}>
				Cancel
			</AlertDialog.Cancel>
			<AlertDialog.Action 
				onclick={() => deleteConversationId && deleteConversation(deleteConversationId)}
				disabled={isLoading}
			>
				{#if isLoading}
					Deleting...
				{:else}
					Delete Conversation
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>