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
	import * as Select from '$lib/components/ui/select';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { 
		Key, 
		Plus, 
		Copy, 
		Trash2, 
		Edit, 
		Eye, 
		EyeOff, 
		AlertTriangle,
		Check,
		MoreHorizontal,
		Calendar,
		Activity
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showCreateDialog = $state(false);
	let showKeyValue = $state(false);
	let deleteKeyId = $state<string | null>(null);
	let createdKey = $state<string | null>(null);
	let isLoading = $state(false);

	// Form state
	let keyName = $state('');
	let keyScopes = $state(['system-prompts:read', 'system-prompts:write', 'structured-outputs:read', 'structured-outputs:write']);
	let rateLimit = $state(100);
	let expiresAt = $state('');

	const scopeOptions = [
		{ value: 'system-prompts:read', label: 'System Prompts - Read access' },
		{ value: 'system-prompts:write', label: 'System Prompts - Create and modify' },
		{ value: 'structured-outputs:read', label: 'Structured Outputs - Read access' },
		{ value: 'structured-outputs:write', label: 'Structured Outputs - Create and modify' },
		{ value: 'api-keys:read', label: 'API Keys - Read access' },
		{ value: 'api-keys:write', label: 'API Keys - Create and modify' },
		{ value: 'files:read', label: 'Files - Read access' },
		{ value: 'files:write', label: 'Files - Upload and modify' },
		{ value: 'conversations:read', label: 'Conversations - Read access' },
		{ value: 'conversations:write', label: 'Conversations - Create and modify' }
	];

	onMount(() => {
		const action = $page.url.searchParams.get('action');
		if (action === 'create') {
			showCreateDialog = true;
		}
	});

	function resetForm() {
		keyName = '';
		keyScopes = ['system-prompts:read', 'system-prompts:write', 'structured-outputs:read', 'structured-outputs:write'];
		rateLimit = 100;
		expiresAt = '';
	}

	async function createApiKey() {
		if (!keyName.trim()) {
			toast.error('Please enter a name for your API key');
			return;
		}

		isLoading = true;

		try {
			const response = await fetch('/api/v1/auth/keys', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: keyName.trim(),
					scopes: keyScopes,
					rate_limit: rateLimit,
					expires_at: expiresAt || null
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error?.message || 'Failed to create API key');
			}

			const result = await response.json();
			createdKey = result.key;
			showCreateDialog = false;
			resetForm();
			
			// Refresh the page to show new key
			goto('/developer/keys', { invalidateAll: true });
			
			toast.success('API key created successfully');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to create API key');
		} finally {
			isLoading = false;
		}
	}

	async function deleteApiKey(keyId: string) {
		isLoading = true;

		try {
			const response = await fetch(`/api/v1/auth/keys/${keyId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error?.message || 'Failed to delete API key');
			}

			deleteKeyId = null;
			
			// Refresh the page
			goto('/developer/keys', { invalidateAll: true });
			
			toast.success('API key deleted successfully');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to delete API key');
		} finally {
			isLoading = false;
		}
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
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getScopeColor(scope: string): string {
		if (scope.endsWith(':read')) {
			return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
		} else if (scope.endsWith(':write')) {
			return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
		} else if (scope.endsWith(':delete')) {
			return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
		}
		
		// Legacy support for old generic scopes
		switch (scope) {
			case 'read': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
			case 'write': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
			case 'delete': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
			default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">API Keys</h1>
			<p class="text-muted-foreground mt-1">
				Manage authentication keys for your applications
			</p>
		</div>
		<Button onclick={() => showCreateDialog = true} class="flex items-center space-x-2">
			<Plus class="h-4 w-4" />
			<span>Create API Key</span>
		</Button>
	</div>

	<!-- API Keys List -->
	{#if data.apiKeys.length === 0}
		<Card.Root class="border-dashed">
			<Card.Content class="p-12 text-center">
				<Key class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
				<h3 class="text-lg font-semibold mb-2">No API Keys</h3>
				<p class="text-muted-foreground mb-6 max-w-sm mx-auto">
					Create your first API key to start using our developer APIs
				</p>
				<Button onclick={() => showCreateDialog = true} size="lg">
					<Plus class="h-4 w-4 mr-2" />
					Create API Key
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4">
			{#each data.apiKeys as apiKey}
				<Card.Root class="relative">
					<Card.Content class="p-6">
						<div class="flex items-start justify-between">
							<div class="space-y-3 flex-1">
								<!-- Key Info -->
								<div class="flex items-center space-x-3">
									<Key class="h-5 w-5 text-muted-foreground" />
									<div>
										<h3 class="font-semibold">{apiKey.name}</h3>
										<div class="flex items-center space-x-2 mt-1">
											<code class="text-xs bg-muted px-2 py-1 rounded font-mono">
												{apiKey.key_prefix}...
											</code>
											{#if !apiKey.is_active}
												<Badge variant="secondary">Inactive</Badge>
											{/if}
										</div>
									</div>
								</div>

								<!-- Scopes -->
								<div class="flex flex-wrap gap-2">
									{#each apiKey.scopes as scope}
										<Badge class={getScopeColor(scope)}>
											{scope}
										</Badge>
									{/each}
								</div>

								<!-- Stats -->
								<div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t">
									<div>
										<p class="text-xs text-muted-foreground">Rate Limit</p>
										<p class="font-medium">{apiKey.rate_limit}/hour</p>
									</div>
									<div>
										<p class="text-xs text-muted-foreground">Usage Count</p>
										<p class="font-medium">{apiKey.usage_count.toLocaleString()}</p>
									</div>
									<div>
										<p class="text-xs text-muted-foreground">Created</p>
										<p class="font-medium text-xs">{formatDate(apiKey.created_at)}</p>
									</div>
									<div>
										<p class="text-xs text-muted-foreground">Last Used</p>
										<p class="font-medium text-xs">
											{apiKey.last_used_at ? formatDate(apiKey.last_used_at) : 'Never'}
										</p>
									</div>
								</div>
							</div>

							<!-- Actions -->
							<div class="flex items-center space-x-2 ml-4">
								<Button 
									size="sm" 
									variant="outline"
									onclick={() => copyToClipboard(apiKey.key_prefix + '...', 'API Key ID')}
								>
									<Copy class="h-4 w-4" />
								</Button>
								<Button 
									size="sm" 
									variant="outline"
									onclick={() => deleteKeyId = apiKey.id}
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</div>

						<!-- Expiration Warning -->
						{#if apiKey.expires_at}
							{@const expiresDate = new Date(apiKey.expires_at)}
							{@const daysUntilExpiry = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))}
							{#if daysUntilExpiry <= 30}
								<div class="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md dark:bg-orange-900/20 dark:border-orange-800">
									<div class="flex items-center space-x-2">
										<AlertTriangle class="h-4 w-4 text-orange-500" />
										<p class="text-sm text-orange-700 dark:text-orange-300">
											{daysUntilExpiry <= 0 
												? 'This API key has expired' 
												: `This API key expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`
											}
										</p>
									</div>
								</div>
							{/if}
						{/if}
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>

<!-- Create API Key Dialog -->
<Dialog.Root bind:open={showCreateDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create API Key</Dialog.Title>
			<Dialog.Description>
				Generate a new API key for your application. Make sure to copy it after creation as it won't be shown again.
			</Dialog.Description>
		</Dialog.Header>
		
		<div class="space-y-4 py-4">
			<div>
				<Label for="key-name">Name</Label>
				<Input 
					id="key-name" 
					bind:value={keyName} 
					placeholder="My Application API Key"
					class="mt-2"
				/>
			</div>

			<div>
				<Label>Permissions</Label>
				<div class="mt-2 space-y-2">
					{#each scopeOptions as option}
						<div class="flex items-center space-x-2">
							<Checkbox 
								checked={keyScopes.includes(option.value)}
								onCheckedChange={(checked) => {
									if (checked) {
										keyScopes = [...keyScopes, option.value];
									} else {
										keyScopes = keyScopes.filter(s => s !== option.value);
									}
								}}
							/>
							<div class="space-y-1">
								<Label class="text-sm font-medium">{option.value.toUpperCase()}</Label>
								<p class="text-xs text-muted-foreground">{option.label}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div>
				<Label for="rate-limit">Rate Limit (requests per hour)</Label>
				<Input 
					id="rate-limit" 
					type="number" 
					bind:value={rateLimit} 
					min="1" 
					max="10000"
					class="mt-2"
				/>
			</div>

			<div>
				<Label for="expires-at">Expiration Date (optional)</Label>
				<Input 
					id="expires-at" 
					type="datetime-local" 
					bind:value={expiresAt}
					class="mt-2"
				/>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => showCreateDialog = false}>
				Cancel
			</Button>
			<Button onclick={createApiKey} disabled={isLoading}>
				{#if isLoading}
					Creating...
				{:else}
					Create API Key
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Show Created Key Dialog -->
{#if createdKey}
	<Dialog.Root open={true}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title class="flex items-center space-x-2">
					<Check class="h-5 w-5 text-green-500" />
					<span>API Key Created</span>
				</Dialog.Title>
				<Dialog.Description>
					Your API key has been created successfully. Copy it now as it won't be shown again.
				</Dialog.Description>
			</Dialog.Header>
			
			<div class="py-4">
				<div class="p-4 bg-muted rounded-md">
					<div class="flex items-center justify-between">
						<code class="text-sm font-mono break-all">{createdKey}</code>
						<Button 
							size="sm" 
							variant="ghost"
							onclick={() => createdKey && copyToClipboard(createdKey, 'API Key')}
						>
							<Copy class="h-4 w-4" />
						</Button>
					</div>
				</div>
				<p class="text-xs text-muted-foreground mt-2">
					Store this key securely. You won't be able to see it again.
				</p>
			</div>

			<Dialog.Footer>
				<Button onclick={() => createdKey = null}>
					I've Copied the Key
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root open={deleteKeyId !== null}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete API Key</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete this API key? This action cannot be undone and will immediately revoke access for any applications using this key.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => deleteKeyId = null}>
				Cancel
			</AlertDialog.Cancel>
			<AlertDialog.Action 
				onclick={() => deleteKeyId && deleteApiKey(deleteKeyId)}
				disabled={isLoading}
			>
				{#if isLoading}
					Deleting...
				{:else}
					Delete Key
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>