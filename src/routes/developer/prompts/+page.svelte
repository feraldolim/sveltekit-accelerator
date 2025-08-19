<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import * as Select from '$lib/components/ui/select/index.js';
	import { 
		FileText, 
		Plus, 
		Search, 
		Trash2, 
		Edit, 
		Copy,
		Play,
		Eye,
		Globe,
		Lock,
		TrendingUp,
		Hash,
		History,
		RotateCcw
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showCreateDialog = $state(false);
	let showEditDialog = $state(false);
	let showViewDialog = $state(false);
	let showVersionDialog = $state(false);
	let deletePromptId = $state<string | null>(null);
	let selectedPrompt = $state<any>(null);
	let editingPrompt = $state<any>(null);
	let versionPrompt = $state<any>(null);
	let promptVersions = $state<any[]>([]);
	let isLoading = $state(false);

	// Form state
	let promptName = $state('');
	let promptDescription = $state('');
	let promptContent = $state('');
	let promptCategory = $state('general');
	let isPublic = $state(false);

	// Edit form state
	let editPromptName = $state('');
	let editPromptDescription = $state('');
	let editPromptContent = $state('');
	let editPromptCategory = $state('general');
	let editIsPublic = $state(false);

	// Filter state
	let searchQuery = $state(data.filters.search || '');
	let selectedCategory = $state(data.filters.category || '');

	onMount(() => {
		const action = $page.url.searchParams.get('action');
		if (action === 'create') {
			showCreateDialog = true;
		}
	});

	function resetForm() {
		promptName = '';
		promptDescription = '';
		promptContent = '';
		promptCategory = 'general';
		isPublic = false;
	}

	async function createSystemPrompt() {
		if (!promptName.trim() || !promptContent.trim()) {
			toast.error('Please enter a name and content for your prompt');
			return;
		}

		isLoading = true;

		try {
			const response = await fetch('/api/v1/prompts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: promptName.trim(),
					description: promptDescription.trim() || undefined,
					content: promptContent.trim(),
					category: promptCategory,
					is_public: isPublic
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error?.message || 'Failed to create system prompt');
			}

			showCreateDialog = false;
			resetForm();
			
			// Refresh the page
			goto('/developer/prompts', { invalidateAll: true });
			
			toast.success('System prompt created successfully');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to create system prompt');
		} finally {
			isLoading = false;
		}
	}

	async function deleteSystemPrompt(promptId: string) {
		isLoading = true;

		try {
			const response = await fetch(`/api/v1/prompts/${promptId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error?.message || 'Failed to delete system prompt');
			}

			deletePromptId = null;
			
			// Refresh the page
			goto('/developer/prompts', { invalidateAll: true });
			
			toast.success('System prompt deleted successfully');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to delete system prompt');
		} finally {
			isLoading = false;
		}
	}

	function resetEditForm() {
		editPromptName = '';
		editPromptDescription = '';
		editPromptContent = '';
		editPromptCategory = 'general';
		editIsPublic = false;
	}

	function editPrompt(prompt: any) {
		editingPrompt = prompt;
		editPromptName = prompt.name;
		editPromptDescription = prompt.description || '';
		editPromptContent = prompt.content;
		editPromptCategory = prompt.category;
		editIsPublic = prompt.is_public;
		showEditDialog = true;
	}

	async function viewVersionHistory(prompt: any) {
		versionPrompt = prompt;
		isLoading = true;
		
		try {
			const response = await fetch(`/api/v1/prompts/${prompt.id}/versions`);
			if (!response.ok) {
				throw new Error('Failed to fetch version history');
			}
			
			const versions = await response.json();
			promptVersions = versions;
			showVersionDialog = true;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to load version history');
		} finally {
			isLoading = false;
		}
	}

	async function restoreVersion(promptId: string, version: number) {
		if (!confirm(`Are you sure you want to restore to version ${version}? This will create a new version with the content from v${version}.`)) {
			return;
		}

		isLoading = true;
		
		try {
			const response = await fetch(`/api/v1/prompts/${promptId}/restore`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					version: version,
					changeSummary: `Restored to version ${version}`
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to restore version');
			}

			showVersionDialog = false;
			// Refresh the page to show the restored version
			goto('/developer/prompts', { invalidateAll: true });
			
			toast.success(`Successfully restored to version ${version}`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to restore version');
		} finally {
			isLoading = false;
		}
	}

	async function updateSystemPrompt() {
		if (!editPromptName.trim() || !editPromptContent.trim()) {
			toast.error('Please enter a name and content for your prompt');
			return;
		}

		if (!editingPrompt) return;

		isLoading = true;

		try {
			const response = await fetch(`/api/v1/prompts/${editingPrompt.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: editPromptName.trim(),
					description: editPromptDescription.trim() || undefined,
					content: editPromptContent.trim(),
					category: editPromptCategory,
					is_public: editIsPublic
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error?.message || 'Failed to update system prompt');
			}

			showEditDialog = false;
			resetEditForm();
			editingPrompt = null;
			
			// Refresh the page
			goto('/developer/prompts', { invalidateAll: true });
			
			toast.success('System prompt updated successfully');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to update system prompt');
		} finally {
			isLoading = false;
		}
	}

	function applyFilters() {
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		if (selectedCategory) params.set('category', selectedCategory);
		
		goto(`/developer/prompts?${params.toString()}`, { invalidateAll: true });
	}

	function clearFilters() {
		searchQuery = '';
		selectedCategory = '';
		goto('/developer/prompts', { invalidateAll: true });
	}

	function viewPrompt(prompt: any) {
		selectedPrompt = prompt;
		showViewDialog = true;
	}

	async function copyToClipboard(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${label} copied to clipboard`);
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function getCategoryColor(category: string): string {
		const colors: Record<string, string> = {
			general: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
			writing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
			analysis: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
			coding: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
			creative: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
			business: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
		};
		return colors[category] || colors.general;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">System Prompts</h1>
			<p class="text-muted-foreground mt-1">
				Create and manage reusable prompt templates with variables
			</p>
		</div>
		<Button onclick={() => showCreateDialog = true} class="flex items-center space-x-2">
			<Plus class="h-4 w-4" />
			<span>Create Prompt</span>
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
							placeholder="Search prompts..."
							class="pl-10"
							onkeydown={(e) => e.key === 'Enter' && applyFilters()}
						/>
					</div>
				</div>
				<Select.Root type="single" bind:value={selectedCategory}>
					<Select.Trigger class="w-[200px]">
						{selectedCategory || "All Categories"}
					</Select.Trigger>
					<Select.Content>
						<Select.Group>
							<Select.Label>Categories</Select.Label>
							<Select.Item value="" label="All Categories">
								All Categories
							</Select.Item>
							{#each data.categories.filter(cat => cat && cat.category) as category (category.category)}
								<Select.Item value={category.category} label={`${category.category} (${category.count})`}>
									{category.category} ({category.count})
								</Select.Item>
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
				<div class="flex space-x-2">
					<Button onclick={applyFilters} size="sm">Apply</Button>
					<Button onclick={clearFilters} variant="outline" size="sm">Clear</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Prompts Grid -->
	{#if data.prompts.length === 0}
		<Card.Root class="border-dashed">
			<Card.Content class="p-12 text-center">
				<FileText class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
				<h3 class="text-lg font-semibold mb-2">
					{data.filters.search || data.filters.category ? 'No prompts found' : 'No System Prompts'}
				</h3>
				<p class="text-muted-foreground mb-6 max-w-sm mx-auto">
					{data.filters.search || data.filters.category 
						? 'Try adjusting your search or filters'
						: 'Create your first system prompt template to get started'
					}
				</p>
				{#if !data.filters.search && !data.filters.category}
					<Button onclick={() => showCreateDialog = true} size="lg">
						<Plus class="h-4 w-4 mr-2" />
						Create System Prompt
					</Button>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each data.prompts as prompt (prompt.id)}
				<Card.Root class="hover:shadow-md transition-shadow">
					<Card.Content class="p-4">
						<div class="space-y-3">
							<!-- Header -->
							<div class="flex items-start justify-between">
								<div class="space-y-1 flex-1">
									<div class="flex items-center space-x-2">
										<h3 class="font-semibold truncate">{prompt.name}</h3>
										{#if prompt.is_public}
											<Globe class="h-3 w-3 text-muted-foreground" />
										{:else}
											<Lock class="h-3 w-3 text-muted-foreground" />
										{/if}
									</div>
									{#if prompt.description}
										<p class="text-xs text-muted-foreground line-clamp-2">
											{prompt.description}
										</p>
									{/if}
								</div>
							</div>

							<!-- Category & Usage -->
							<div class="flex items-center justify-between">
								<div class="flex items-center space-x-2">
									<Badge class={getCategoryColor(prompt.category)}>
										{prompt.category}
									</Badge>
									<Badge variant="outline" class="text-xs">
										v{prompt.version || 1}
									</Badge>
								</div>
								<div class="flex items-center space-x-1 text-xs text-muted-foreground">
									<TrendingUp class="h-3 w-3" />
									<span>{prompt.usage_count}</span>
								</div>
							</div>

							<!-- Preview -->
							<div class="p-2 bg-muted rounded text-xs font-mono line-clamp-3">
								{prompt.content.substring(0, 150)}...
							</div>

							<!-- Variables -->
							{#if Object.keys(prompt.variables).length > 0}
								<div class="flex flex-wrap gap-1">
									{#each Object.keys(prompt.variables).slice(0, 3) as variable (variable)}
										<Badge variant="outline" class="text-xs">
											<Hash class="h-2 w-2 mr-1" />
											{variable}
										</Badge>
									{/each}
									{#if Object.keys(prompt.variables).length > 3}
										<Badge variant="outline" class="text-xs">
											+{Object.keys(prompt.variables).length - 3}
										</Badge>
									{/if}
								</div>
							{/if}

							<!-- Footer -->
							<div class="flex items-center justify-between pt-2 border-t">
								<span class="text-xs text-muted-foreground">
									{formatDate(prompt.created_at)}
								</span>
								<div class="flex items-center space-x-1">
									<Button 
										size="sm" 
										variant="ghost"
										onclick={() => viewPrompt(prompt)}
									>
										<Eye class="h-3 w-3" />
									</Button>
									<Button 
										size="sm" 
										variant="ghost"
										onclick={() => editPrompt(prompt)}
									>
										<Edit class="h-3 w-3" />
									</Button>
									<Button 
										size="sm" 
										variant="ghost"
										onclick={() => viewVersionHistory(prompt)}
									>
										<History class="h-3 w-3" />
									</Button>
									<Button 
										size="sm" 
										variant="ghost"
										onclick={() => copyToClipboard(prompt.content, 'Prompt content')}
									>
										<Copy class="h-3 w-3" />
									</Button>
									<Button 
										size="sm" 
										variant="ghost"
										onclick={() => deletePromptId = prompt.id}
									>
										<Trash2 class="h-3 w-3" />
									</Button>
								</div>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>

<!-- Create System Prompt Dialog -->
<Dialog.Root bind:open={showCreateDialog}>
	<Dialog.Content class="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Create System Prompt</Dialog.Title>
			<Dialog.Description>
				Create a reusable prompt template with variables for dynamic content
			</Dialog.Description>
		</Dialog.Header>
		
		<div class="space-y-4 py-4">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="prompt-name">Name *</Label>
					<Input 
						id="prompt-name" 
						bind:value={promptName} 
						placeholder="Customer Support Assistant"
						class="mt-2"
					/>
				</div>
				<div>
					<Label for="prompt-category">Category</Label>
					<Select.Root type="single" bind:value={promptCategory}>
						<Select.Trigger class="mt-2 w-full">
							{promptCategory || "Select category"}
						</Select.Trigger>
						<Select.Content>
							<Select.Group>
								<Select.Label>Categories</Select.Label>
								<Select.Item value="general" label="General">General</Select.Item>
								<Select.Item value="writing" label="Writing">Writing</Select.Item>
								<Select.Item value="analysis" label="Analysis">Analysis</Select.Item>
								<Select.Item value="coding" label="Coding">Coding</Select.Item>
								<Select.Item value="creative" label="Creative">Creative</Select.Item>
								<Select.Item value="business" label="Business">Business</Select.Item>
							</Select.Group>
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<div>
				<Label for="prompt-description">Description</Label>
				<Input 
					id="prompt-description" 
					bind:value={promptDescription} 
					placeholder="A helpful assistant for customer support queries"
					class="mt-2"
				/>
			</div>

			<div>
				<Label for="prompt-content">Prompt Content *</Label>
				<Textarea
					id="prompt-content"
					bind:value={promptContent}
					placeholder="You are a helpful customer support assistant for [company_name]. Always be polite and professional. Current date: [current_date]"
					class="mt-2 min-h-[200px] font-mono"
				/>
				<p class="text-xs text-muted-foreground mt-1">
					Use &#123;&#123;variable_name&#125;&#125; for dynamic variables. Built-in functions: &#123;&#123;NOW&#125;&#125;, &#123;&#123;RANDOM_UUID&#125;&#125;, &#123;&#123;UPPER(text)&#125;&#125;
				</p>
			</div>

			<div class="flex items-center space-x-2">
				<input 
					type="checkbox" 
					id="is-public" 
					bind:checked={isPublic} 
					class="rounded"
				/>
				<Label for="is-public" class="text-sm">
					Make this prompt publicly available in the marketplace
				</Label>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => showCreateDialog = false}>
				Cancel
			</Button>
			<Button onclick={createSystemPrompt} disabled={isLoading}>
				{#if isLoading}
					Creating...
				{:else}
					Create Prompt
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit System Prompt Dialog -->
<Dialog.Root bind:open={showEditDialog}>
	<Dialog.Content class="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Edit System Prompt</Dialog.Title>
			<Dialog.Description>
				Update your prompt template with variables for dynamic content
			</Dialog.Description>
		</Dialog.Header>
		
		<div class="space-y-4 py-4">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="edit-prompt-name">Name *</Label>
					<Input 
						id="edit-prompt-name" 
						bind:value={editPromptName} 
						placeholder="Customer Support Assistant"
						class="mt-2"
					/>
				</div>
				<div>
					<Label for="edit-prompt-category">Category</Label>
					<Select.Root type="single" bind:value={editPromptCategory}>
						<Select.Trigger class="mt-2 w-full">
							{editPromptCategory || "Select category"}
						</Select.Trigger>
						<Select.Content>
							<Select.Group>
								<Select.Label>Categories</Select.Label>
								<Select.Item value="general" label="General">General</Select.Item>
								<Select.Item value="writing" label="Writing">Writing</Select.Item>
								<Select.Item value="analysis" label="Analysis">Analysis</Select.Item>
								<Select.Item value="coding" label="Coding">Coding</Select.Item>
								<Select.Item value="creative" label="Creative">Creative</Select.Item>
								<Select.Item value="business" label="Business">Business</Select.Item>
							</Select.Group>
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<div>
				<Label for="edit-prompt-description">Description</Label>
				<Input 
					id="edit-prompt-description" 
					bind:value={editPromptDescription} 
					placeholder="A helpful assistant for customer support queries"
					class="mt-2"
				/>
			</div>

			<div>
				<Label for="edit-prompt-content">Prompt Content *</Label>
				<Textarea
					id="edit-prompt-content"
					bind:value={editPromptContent}
					placeholder="You are a helpful customer support assistant for [company_name]. Always be polite and professional. Current date: [current_date]"
					class="mt-2 min-h-[200px] font-mono"
				/>
				<p class="text-xs text-muted-foreground mt-1">
					Use &#123;&#123;variable_name&#125;&#125; for dynamic variables. Built-in functions: &#123;&#123;NOW&#125;&#125;, &#123;&#123;RANDOM_UUID&#125;&#125;, &#123;&#123;UPPER(text)&#125;&#125;
				</p>
			</div>

			<div class="flex items-center space-x-2">
				<input 
					type="checkbox" 
					id="edit-is-public" 
					bind:checked={editIsPublic} 
					class="rounded"
				/>
				<Label for="edit-is-public" class="text-sm">
					Make this prompt publicly available in the marketplace
				</Label>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => showEditDialog = false}>
				Cancel
			</Button>
			<Button onclick={updateSystemPrompt} disabled={isLoading}>
				{#if isLoading}
					Updating...
				{:else}
					Update Prompt
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- View Prompt Dialog -->
{#if selectedPrompt}
	<Dialog.Root bind:open={showViewDialog}>
		<Dialog.Content class="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
			<Dialog.Header>
				<Dialog.Title class="flex items-center space-x-2">
					<FileText class="h-5 w-5" />
					<span>{selectedPrompt.name}</span>
					{#if selectedPrompt.is_public}
						<Badge variant="secondary">Public</Badge>
					{/if}
				</Dialog.Title>
				<Dialog.Description>
					{selectedPrompt.description || 'System prompt template'}
				</Dialog.Description>
			</Dialog.Header>
			
			<div class="space-y-4 py-4">
				<!-- Metadata -->
				<div class="grid grid-cols-2 gap-4 p-4 bg-muted rounded">
					<div>
						<p class="text-xs font-medium text-muted-foreground">Category</p>
						<Badge class={getCategoryColor(selectedPrompt.category)}>
							{selectedPrompt.category}
						</Badge>
					</div>
					<div>
						<p class="text-xs font-medium text-muted-foreground">Usage Count</p>
						<p class="font-medium">{selectedPrompt.usage_count}</p>
					</div>
					<div>
						<p class="text-xs font-medium text-muted-foreground">Created</p>
						<p class="text-sm">{formatDate(selectedPrompt.created_at)}</p>
					</div>
					<div>
						<p class="text-xs font-medium text-muted-foreground">Variables</p>
						<p class="text-sm">{Object.keys(selectedPrompt.variables).length}</p>
					</div>
				</div>

				<!-- Content -->
				<div>
					<Label>Prompt Content</Label>
					<div class="mt-2 p-4 bg-muted rounded font-mono text-sm whitespace-pre-wrap">
						{selectedPrompt.content}
					</div>
				</div>

				<!-- Variables -->
				{#if Object.keys(selectedPrompt.variables).length > 0}
					<div>
						<Label>Variables</Label>
						<div class="mt-2 space-y-2">
							{#each Object.entries(selectedPrompt.variables) as [name, config] (name)}
								<div class="p-3 border rounded">
									<div class="flex items-center justify-between mb-1">
										<code class="text-sm font-mono">{name}</code>
										<Badge variant="outline">{config.type}</Badge>
									</div>
									{#if config.description}
										<p class="text-xs text-muted-foreground">{config.description}</p>
									{/if}
									{#if config.required}
										<Badge variant="secondary" class="text-xs mt-1">Required</Badge>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<Dialog.Footer>
				<Button 
					variant="outline" 
					onclick={() => copyToClipboard(selectedPrompt.content, 'Prompt content')}
				>
					<Copy class="h-4 w-4 mr-2" />
					Copy Content
				</Button>
				<Button onclick={() => showViewDialog = false}>
					Close
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<!-- Version History Dialog -->
{#if versionPrompt}
	<Dialog.Root bind:open={showVersionDialog}>
		<Dialog.Content class="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
			<Dialog.Header>
				<Dialog.Title class="flex items-center space-x-2">
					<History class="h-5 w-5" />
					<span>Version History - {versionPrompt.name}</span>
					<Badge variant="outline">Current: v{versionPrompt.version || 1}</Badge>
				</Dialog.Title>
				<Dialog.Description>
					View and manage different versions of this prompt. Click the restore button (↻) to make an older version active again.
				</Dialog.Description>
			</Dialog.Header>
			
			<div class="space-y-4 py-4">
				{#if promptVersions.length === 0}
					<div class="text-center py-8">
						<History class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
						<h3 class="text-lg font-semibold mb-2">No Version History</h3>
						<p class="text-muted-foreground">
							This prompt hasn't been edited yet. Version history will appear here after you make changes.
						</p>
					</div>
				{:else}
					<div class="space-y-3">
						<!-- Current Version -->
						<div class="border rounded-lg p-4 bg-primary/5 border-primary/20">
							<div class="flex items-center justify-between mb-3">
								<div class="flex items-center space-x-2">
									<Badge variant="default">
										v{versionPrompt.version || 1} (Current)
									</Badge>
									<span class="text-sm text-muted-foreground">
										{new Date(versionPrompt.updated_at).toLocaleDateString('en-US', {
											year: 'numeric',
											month: 'short',
											day: 'numeric',
											hour: '2-digit',
											minute: '2-digit'
										})}
									</span>
								</div>
								<Button size="sm" variant="outline" onclick={() => viewPrompt(versionPrompt)}>
									<Eye class="h-3 w-3 mr-1" />
									View
								</Button>
							</div>
							<div class="text-sm">
								<p class="font-medium">{versionPrompt.name}</p>
								<p class="text-muted-foreground line-clamp-2">
									{versionPrompt.content.substring(0, 100)}...
								</p>
							</div>
						</div>
						
						<!-- Previous Versions -->
						{#each promptVersions as version (version.id)}
							<div class="border rounded-lg p-4">
								<div class="flex items-center justify-between mb-3">
									<div class="flex items-center space-x-2">
										<Badge variant="outline">
											v{version.version}
										</Badge>
										<span class="text-sm text-muted-foreground">
											{new Date(version.created_at).toLocaleDateString('en-US', {
												year: 'numeric',
												month: 'short',
												day: 'numeric',
												hour: '2-digit',
												minute: '2-digit'
											})}
										</span>
										{#if version.change_summary}
											<span class="text-xs text-muted-foreground">
												• {version.change_summary}
											</span>
										{/if}
									</div>
									<div class="flex items-center space-x-1">
										<Button size="sm" variant="outline" onclick={() => {
											selectedPrompt = version;
											showViewDialog = true;
										}}>
											<Eye class="h-3 w-3" />
										</Button>
										<Button size="sm" variant="outline" onclick={() => copyToClipboard(version.content, 'Version content')}>
											<Copy class="h-3 w-3" />
										</Button>
										<Button 
											size="sm" 
											variant="outline"
											onclick={() => restoreVersion(versionPrompt.id, version.version)}
											disabled={isLoading}
										>
											<RotateCcw class="h-3 w-3" />
										</Button>
									</div>
								</div>
								<div class="text-sm">
									<p class="font-medium">{version.name}</p>
									<p class="text-muted-foreground line-clamp-2">
										{version.content.substring(0, 100)}...
									</p>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<Dialog.Footer>
				<Button onclick={() => showVersionDialog = false}>
					Close
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root open={deletePromptId !== null}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete System Prompt</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete this system prompt? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => deletePromptId = null}>
				Cancel
			</AlertDialog.Cancel>
			<AlertDialog.Action 
				onclick={() => deletePromptId && deleteSystemPrompt(deletePromptId)}
				disabled={isLoading}
			>
				{#if isLoading}
					Deleting...
				{:else}
					Delete Prompt
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>