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
	import { 
		Code2, 
		Plus, 
		Search, 
		Trash2, 
		Edit, 
		Copy,
		Eye,
		Braces,
		Hash,
		TrendingUp,
		CheckCircle,
		AlertCircle,
		History,
		RotateCcw,
		Globe,
		Lock
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showCreateDialog = $state(false);
	let showEditDialog = $state(false);
	let showViewDialog = $state(false);
	let showVersionDialog = $state(false);
	let deleteSchemaId = $state<string | null>(null);
	let selectedSchema = $state<any>(null);
	let editingSchema = $state<any>(null);
	let versionSchema = $state<any>(null);
	let schemaVersions = $state<any[]>([]);
	let isLoading = $state(false);

	// Form state
	let schemaName = $state('');
	let schemaDescription = $state('');
	let schemaContent = $state('');
	let isPublic = $state(false);

	// Edit form state
	let editSchemaName = $state('');
	let editSchemaDescription = $state('');
	let editSchemaContent = $state('');
	let editIsPublic = $state(false);

	// Filter state
	let searchQuery = $state(data.filters.search || '');

	onMount(() => {
		const action = $page.url.searchParams.get('action');
		if (action === 'create') {
			showCreateDialog = true;
		}
	});

	function resetForm() {
		schemaName = '';
		schemaDescription = '';
		schemaContent = '';
		isPublic = false;
	}

	function resetEditForm() {
		editSchemaName = '';
		editSchemaDescription = '';
		editSchemaContent = '';
		editIsPublic = false;
	}

	async function createSchema() {
		if (!schemaName.trim() || !schemaContent.trim()) {
			toast.error('Please enter a name and schema content');
			return;
		}

		// Validate JSON schema
		try {
			JSON.parse(schemaContent);
		} catch {
			toast.error('Please enter valid JSON schema content');
			return;
		}

		isLoading = true;

		try {
			const response = await fetch('/api/v1/structured-outputs', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: schemaName.trim(),
					description: schemaDescription.trim() || undefined,
					json_schema: JSON.parse(schemaContent),
					is_public: isPublic
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error?.message || 'Failed to create schema');
			}

			showCreateDialog = false;
			resetForm();
			
			// Refresh the page
			goto('/developer/schemas', { invalidateAll: true });
			
			toast.success('Schema created successfully');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to create schema');
		} finally {
			isLoading = false;
		}
	}

	async function deleteSchema(schemaId: string) {
		isLoading = true;

		try {
			const response = await fetch(`/api/v1/structured-outputs/${schemaId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error?.message || 'Failed to delete schema');
			}

			deleteSchemaId = null;
			
			// Refresh the page
			goto('/developer/schemas', { invalidateAll: true });
			
			toast.success('Schema deleted successfully');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to delete schema');
		} finally {
			isLoading = false;
		}
	}

	function editSchema(schema: any) {
		editingSchema = schema;
		editSchemaName = schema.name;
		editSchemaDescription = schema.description || '';
		editSchemaContent = JSON.stringify(schema.json_schema, null, 2);
		editIsPublic = schema.is_public;
		showEditDialog = true;
	}

	async function updateSchema() {
		if (!editSchemaName.trim() || !editSchemaContent.trim()) {
			toast.error('Please enter a name and schema content');
			return;
		}

		// Validate JSON schema
		try {
			JSON.parse(editSchemaContent);
		} catch {
			toast.error('Please enter valid JSON schema content');
			return;
		}

		if (!editingSchema) return;

		isLoading = true;

		try {
			const response = await fetch(`/api/v1/structured-outputs/${editingSchema.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: editSchemaName.trim(),
					description: editSchemaDescription.trim() || undefined,
					json_schema: JSON.parse(editSchemaContent),
					is_public: editIsPublic
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error?.message || 'Failed to update schema');
			}

			showEditDialog = false;
			resetEditForm();
			editingSchema = null;
			
			// Refresh the page
			goto('/developer/schemas', { invalidateAll: true });
			
			toast.success('Schema updated successfully');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to update schema');
		} finally {
			isLoading = false;
		}
	}

	async function viewVersionHistory(schema: any) {
		versionSchema = schema;
		isLoading = true;
		
		try {
			const response = await fetch(`/api/v1/structured-outputs/${schema.id}/versions`);
			if (!response.ok) {
				throw new Error('Failed to fetch version history');
			}
			
			const versions = await response.json();
			schemaVersions = versions;
			showVersionDialog = true;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to load version history');
		} finally {
			isLoading = false;
		}
	}

	async function restoreVersion(schemaId: string, version: number) {
		if (!confirm(`Are you sure you want to restore to version ${version}? This will create a new version with the content from v${version}.`)) {
			return;
		}

		isLoading = true;
		
		try {
			const response = await fetch(`/api/v1/structured-outputs/${schemaId}/restore`, {
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
			goto('/developer/schemas', { invalidateAll: true });
			
			toast.success(`Successfully restored to version ${version}`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to delete schema');
		} finally {
			isLoading = false;
		}
	}

	function applyFilters() {
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		
		goto(`/developer/schemas?${params.toString()}`, { invalidateAll: true });
	}

	function clearFilters() {
		searchQuery = '';
		goto('/developer/schemas', { invalidateAll: true });
	}

	function viewSchema(schema: any) {
		selectedSchema = schema;
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

	function getStatusColor(isValid: boolean): string {
		return isValid 
			? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
			: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
	}

	function formatSchema(schema: any): string {
		return JSON.stringify(schema, null, 2);
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Structured Output Schemas</h1>
			<p class="text-muted-foreground mt-1">
				Define JSON schemas for structured AI responses and data validation
			</p>
		</div>
		<Button onclick={() => showCreateDialog = true} class="flex items-center space-x-2">
			<Plus class="h-4 w-4" />
			<span>Create Schema</span>
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
							placeholder="Search schemas..."
							class="pl-10"
							onkeydown={(e) => e.key === 'Enter' && applyFilters()}
						/>
					</div>
				</div>
				<div class="flex space-x-2 md:col-span-2">
					<Button onclick={applyFilters} size="sm">Apply</Button>
					<Button onclick={clearFilters} variant="outline" size="sm">Clear</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Schemas Grid -->
	{#if data.schemas.length === 0}
		<Card.Root class="border-dashed">
			<Card.Content class="p-12 text-center">
				<Code2 class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
				<h3 class="text-lg font-semibold mb-2">
					{data.filters.search ? 'No schemas found' : 'No Schemas'}
				</h3>
				<p class="text-muted-foreground mb-6 max-w-sm mx-auto">
					{data.filters.search 
						? 'Try adjusting your search query'
						: 'Create your first JSON schema to define structured output formats'
					}
				</p>
				{#if !data.filters.search}
					<Button onclick={() => showCreateDialog = true} size="lg">
						<Plus class="h-4 w-4 mr-2" />
						Create Schema
					</Button>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each data.schemas as schema}
				<Card.Root class="hover:shadow-md transition-shadow">
					<Card.Content class="p-4">
						<div class="space-y-3">
							<!-- Header -->
							<div class="flex items-start justify-between">
								<div class="space-y-1 flex-1">
									<div class="flex items-center space-x-2">
										<h3 class="font-semibold truncate">{schema.name}</h3>
										<Badge class={getStatusColor(schema.is_valid)}>
											{#if schema.is_valid}
												<CheckCircle class="h-3 w-3 mr-1" />
											{:else}
												<AlertCircle class="h-3 w-3 mr-1" />
											{/if}
											{schema.is_valid ? 'Valid' : 'Invalid'} <!-- Debug: {JSON.stringify(schema.is_valid)} -->
										</Badge>
									</div>
									{#if schema.description}
										<p class="text-xs text-muted-foreground line-clamp-2">
											{schema.description}
										</p>
									{/if}
								</div>
							</div>

							<!-- Version & Usage -->
							<div class="flex items-center justify-between">
								<div class="flex items-center space-x-2">
									<Badge variant="outline" class="text-xs">
										v{schema.version || 1}
									</Badge>
									{#if schema.is_public}
										<Globe class="h-3 w-3 text-muted-foreground" />
									{:else}
										<Lock class="h-3 w-3 text-muted-foreground" />
									{/if}
								</div>
								<div class="flex items-center space-x-1 text-xs text-muted-foreground">
									<TrendingUp class="h-3 w-3" />
									<span>{schema.usage_count}</span>
								</div>
							</div>

							<!-- Schema Preview -->
							<div class="p-2 bg-muted rounded text-xs font-mono line-clamp-4">
								{JSON.stringify(schema.json_schema, null, 2).substring(0, 200)}...
							</div>

							<!-- Properties Count -->
							{#if schema.json_schema?.properties}
								<div class="flex items-center space-x-1 text-xs text-muted-foreground">
									<Hash class="h-3 w-3" />
									<span>{Object.keys(schema.json_schema.properties).length} properties</span>
								</div>
							{/if}

							<!-- Footer -->
							<div class="flex items-center justify-between pt-2 border-t">
								<span class="text-xs text-muted-foreground">
									{formatDate(schema.created_at)}
								</span>
								<div class="flex items-center space-x-1">
									<Button 
										size="sm" 
										variant="ghost"
										onclick={() => viewSchema(schema)}
									>
										<Eye class="h-3 w-3" />
									</Button>
									<Button 
										size="sm" 
										variant="ghost"
										onclick={() => editSchema(schema)}
									>
										<Edit class="h-3 w-3" />
									</Button>
									<Button 
										size="sm" 
										variant="ghost"
										onclick={() => viewVersionHistory(schema)}
									>
										<History class="h-3 w-3" />
									</Button>
									<Button 
										size="sm" 
										variant="ghost"
										onclick={() => copyToClipboard(formatSchema(schema.json_schema), 'Schema content')}
									>
										<Copy class="h-3 w-3" />
									</Button>
									<Button 
										size="sm" 
										variant="ghost"
										onclick={() => deleteSchemaId = schema.id}
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

<!-- Create Schema Dialog -->
<Dialog.Root bind:open={showCreateDialog}>
	<Dialog.Content class="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Create Schema</Dialog.Title>
			<Dialog.Description>
				Create a JSON schema to define structured output formats for AI responses
			</Dialog.Description>
		</Dialog.Header>
		
		<div class="space-y-4 py-4">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="schema-name">Name *</Label>
					<Input 
						id="schema-name" 
						bind:value={schemaName} 
						placeholder="User Profile Schema"
						class="mt-2"
					/>
				</div>
				<div class="flex items-center space-x-2">
					<input 
						type="checkbox" 
						id="is-public" 
						bind:checked={isPublic} 
						class="rounded"
					/>
					<Label for="is-public" class="text-sm">
						Make this schema publicly available
					</Label>
				</div>
			</div>

			<div>
				<Label for="schema-description">Description</Label>
				<Input 
					id="schema-description" 
					bind:value={schemaDescription} 
					placeholder="Schema for user profile data structure"
					class="mt-2"
				/>
			</div>

			<div>
				<Label for="schema-content">JSON Schema *</Label>
				<Textarea
					id="schema-content"
					bind:value={schemaContent}
					placeholder={`{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "User's full name"
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "age": {
      "type": "integer",
      "minimum": 0
    }
  },
  "required": ["name", "email"]
}`}
					class="mt-2 min-h-[300px] font-mono"
				/>
				<p class="text-xs text-muted-foreground mt-1">
					Enter valid JSON Schema (draft-07 specification). This will be used to validate AI responses.
				</p>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => showCreateDialog = false}>
				Cancel
			</Button>
			<Button onclick={createSchema} disabled={isLoading}>
				{#if isLoading}
					Creating...
				{:else}
					Create Schema
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Schema Dialog -->
<Dialog.Root bind:open={showEditDialog}>
	<Dialog.Content class="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Edit Schema</Dialog.Title>
			<Dialog.Description>
				Update your JSON schema definition and properties
			</Dialog.Description>
		</Dialog.Header>
		
		<div class="space-y-4 py-4">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="edit-schema-name">Name *</Label>
					<Input 
						id="edit-schema-name" 
						bind:value={editSchemaName} 
						placeholder="User Profile Schema"
						class="mt-2"
					/>
				</div>
				<div class="flex items-center space-x-2">
					<input 
						type="checkbox" 
						id="edit-is-public" 
						bind:checked={editIsPublic} 
						class="rounded"
					/>
					<Label for="edit-is-public" class="text-sm">
						Make this schema publicly available
					</Label>
				</div>
			</div>

			<div>
				<Label for="edit-schema-description">Description</Label>
				<Input 
					id="edit-schema-description" 
					bind:value={editSchemaDescription} 
					placeholder="Schema for user profile data structure"
					class="mt-2"
				/>
			</div>

			<div>
				<Label for="edit-schema-content">JSON Schema *</Label>
				<Textarea
					id="edit-schema-content"
					bind:value={editSchemaContent}
					placeholder={`{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "User's full name"
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "age": {
      "type": "integer",
      "minimum": 0
    }
  },
  "required": ["name", "email"]
}`}
					class="mt-2 min-h-[300px] font-mono"
				/>
				<p class="text-xs text-muted-foreground mt-1">
					Enter valid JSON Schema (draft-07 specification). This will be used to validate AI responses.
				</p>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => showEditDialog = false}>
				Cancel
			</Button>
			<Button onclick={updateSchema} disabled={isLoading}>
				{#if isLoading}
					Updating...
				{:else}
					Update Schema
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- View Schema Dialog -->
{#if selectedSchema}
	<Dialog.Root bind:open={showViewDialog}>
		<Dialog.Content class="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
			<Dialog.Header>
				<Dialog.Title class="flex items-center space-x-2">
					<Braces class="h-5 w-5" />
					<span>{selectedSchema.name}</span>
					<Badge class={getStatusColor(selectedSchema.is_valid)}>
						{#if selectedSchema.is_valid}
							<CheckCircle class="h-3 w-3 mr-1" />
						{:else}
							<AlertCircle class="h-3 w-3 mr-1" />
						{/if}
						{selectedSchema.is_valid ? 'Valid' : 'Invalid'}
					</Badge>
				</Dialog.Title>
				<Dialog.Description>
					{selectedSchema.description || 'JSON Schema definition'}
				</Dialog.Description>
			</Dialog.Header>
			
			<div class="space-y-4 py-4">
				<!-- Metadata -->
				<div class="grid grid-cols-3 gap-4 p-4 bg-muted rounded">
					<div>
						<p class="text-xs font-medium text-muted-foreground">Version</p>
						<p class="font-medium">v{selectedSchema.version}</p>
					</div>
					<div>
						<p class="text-xs font-medium text-muted-foreground">Usage Count</p>
						<p class="font-medium">{selectedSchema.usage_count}</p>
					</div>
					<div>
						<p class="text-xs font-medium text-muted-foreground">Created</p>
						<p class="text-sm">{formatDate(selectedSchema.created_at)}</p>
					</div>
				</div>

				<!-- Schema Content -->
				<div>
					<Label>Schema Definition</Label>
					<div class="mt-2 p-4 bg-muted rounded font-mono text-sm whitespace-pre-wrap overflow-x-auto">
						{formatSchema(selectedSchema.json_schema || selectedSchema.schema)}
					</div>
				</div>

				<!-- Properties -->
				{#if (selectedSchema.json_schema || selectedSchema.schema)?.properties}
					{@const schemaData = selectedSchema.json_schema || selectedSchema.schema}
					<div>
						<Label>Properties ({Object.keys(schemaData.properties).length})</Label>
						<div class="mt-2 space-y-2">
							{#each Object.entries(schemaData.properties) as [name, prop]}
								<div class="p-3 border rounded">
									<div class="flex items-center justify-between mb-1">
										<code class="text-sm font-mono">{name}</code>
										<Badge variant="outline">{prop.type || 'any'}</Badge>
									</div>
									{#if prop.description}
										<p class="text-xs text-muted-foreground">{prop.description}</p>
									{/if}
									{#if schemaData.required && schemaData.required.includes(name)}
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
					onclick={() => copyToClipboard(formatSchema(selectedSchema.json_schema || selectedSchema.schema), 'Schema content')}
				>
					<Copy class="h-4 w-4 mr-2" />
					Copy Schema
				</Button>
				<Button onclick={() => showViewDialog = false}>
					Close
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<!-- Version History Dialog -->
{#if versionSchema}
	<Dialog.Root bind:open={showVersionDialog}>
		<Dialog.Content class="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
			<Dialog.Header>
				<Dialog.Title class="flex items-center space-x-2">
					<History class="h-5 w-5" />
					<span>Version History - {versionSchema.name}</span>
					<Badge variant="outline">Current: v{versionSchema.version || 1}</Badge>
				</Dialog.Title>
				<Dialog.Description>
					View and manage different versions of this schema. Click the restore button (↻) to make an older version active again.
				</Dialog.Description>
			</Dialog.Header>
			
			<div class="space-y-4 py-4">
				{#if schemaVersions.length === 0}
					<div class="text-center py-8">
						<History class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
						<h3 class="text-lg font-semibold mb-2">No Version History</h3>
						<p class="text-muted-foreground">
							This schema hasn't been edited yet. Version history will appear here after you make changes.
						</p>
					</div>
				{:else}
					<div class="space-y-3">
						<!-- Current Version -->
						<div class="border rounded-lg p-4 bg-primary/5 border-primary/20">
							<div class="flex items-center justify-between mb-3">
								<div class="flex items-center space-x-2">
									<Badge variant="default">
										v{versionSchema.version || 1} (Current)
									</Badge>
									<span class="text-sm text-muted-foreground">
										{new Date(versionSchema.updated_at).toLocaleDateString('en-US', {
											year: 'numeric',
											month: 'short',
											day: 'numeric',
											hour: '2-digit',
											minute: '2-digit'
										})}
									</span>
								</div>
								<Button size="sm" variant="outline" onclick={() => viewSchema(versionSchema)}>
									<Eye class="h-3 w-3 mr-1" />
									View
								</Button>
							</div>
							<div class="text-sm">
								<p class="font-medium">{versionSchema.name}</p>
								<p class="text-muted-foreground line-clamp-2">
									{JSON.stringify(versionSchema.json_schema, null, 2).substring(0, 100)}...
								</p>
							</div>
						</div>
						
						<!-- Previous Versions -->
						{#each schemaVersions as version (version.id)}
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
											selectedSchema = version;
											showViewDialog = true;
										}}>
											<Eye class="h-3 w-3" />
										</Button>
										<Button size="sm" variant="outline" onclick={() => copyToClipboard(JSON.stringify(version.json_schema, null, 2), 'Version content')}>
											<Copy class="h-3 w-3" />
										</Button>
										<Button 
											size="sm" 
											variant="outline"
											onclick={() => restoreVersion(versionSchema.id, version.version)}
											disabled={isLoading}
										>
											<RotateCcw class="h-3 w-3" />
										</Button>
									</div>
								</div>
								<div class="text-sm">
									<p class="font-medium">{version.name}</p>
									<p class="text-muted-foreground line-clamp-2">
										{JSON.stringify(version.json_schema, null, 2).substring(0, 100)}...
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
<AlertDialog.Root open={deleteSchemaId !== null}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Schema</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete this schema? This action cannot be undone and may affect any applications using this schema.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => deleteSchemaId = null}>
				Cancel
			</AlertDialog.Cancel>
			<AlertDialog.Action 
				onclick={() => deleteSchemaId && deleteSchema(deleteSchemaId)}
				disabled={isLoading}
			>
				{#if isLoading}
					Deleting...
				{:else}
					Delete Schema
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>