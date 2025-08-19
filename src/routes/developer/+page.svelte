<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Progress } from '$lib/components/ui/progress';
	import { 
		Key, 
		FileText, 
		Settings, 
		BarChart3, 
		Upload, 
		MessageSquare,
		TrendingUp,
		Activity,
		Zap,
		Plus,
		ExternalLink,
		AlertCircle
	} from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatNumber(num: number): string {
		if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
		if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
		return num.toString();
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	const quickActions = [
		{
			title: 'Create API Key',
			description: 'Generate a new API key for your application',
			href: '/developer/keys?action=create',
			icon: Key,
			color: 'bg-blue-500'
		},
		{
			title: 'New System Prompt',
			description: 'Create a reusable prompt template',
			href: '/developer/prompts?action=create',
			icon: FileText,
			color: 'bg-green-500'
		},
		{
			title: 'Design Schema',
			description: 'Define structured output schema',
			href: '/developer/schemas?action=create',
			icon: Settings,
			color: 'bg-purple-500'
		},
		{
			title: 'View Analytics',
			description: 'File processing metrics from chat',
			href: '/developer/files',
			icon: BarChart3,
			color: 'bg-orange-500'
		}
	];
</script>

<div class="space-y-6">
	<!-- Welcome Section -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Developer Console</h1>
			<p class="text-muted-foreground mt-2">
				Manage your API integrations and monitor usage across all services
			</p>
		</div>
		<Button href="/docs/features/api-reference" variant="outline" class="flex items-center space-x-2">
			<ExternalLink class="h-4 w-4" />
			<span>API Documentation</span>
		</Button>
	</div>

	<!-- Quick Stats Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		<!-- API Keys -->
		<Card.Root>
			<Card.Content class="p-6">
				<div class="flex items-center justify-between">
					<div class="space-y-1">
						<p class="text-sm font-medium text-muted-foreground">API Keys</p>
						<div class="flex items-center space-x-2">
							<span class="text-2xl font-bold">{data.stats.api_keys.total}</span>
							<Badge variant="secondary" class="text-xs">
								{data.stats.api_keys.active} active
							</Badge>
						</div>
					</div>
					<Key class="h-8 w-8 text-muted-foreground" />
				</div>
			</Card.Content>
		</Card.Root>

		<!-- API Requests -->
		<Card.Root>
			<Card.Content class="p-6">
				<div class="flex items-center justify-between">
					<div class="space-y-1">
						<p class="text-sm font-medium text-muted-foreground">Requests (7d)</p>
						<div class="flex items-center space-x-2">
							<span class="text-2xl font-bold">{formatNumber(data.stats.usage.requests_7d)}</span>
							<TrendingUp class="h-4 w-4 text-green-500" />
						</div>
					</div>
					<BarChart3 class="h-8 w-8 text-muted-foreground" />
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Tokens Used -->
		<Card.Root>
			<Card.Content class="p-6">
				<div class="flex items-center justify-between">
					<div class="space-y-1">
						<p class="text-sm font-medium text-muted-foreground">Tokens (7d)</p>
						<div class="flex items-center space-x-2">
							<span class="text-2xl font-bold">{formatNumber(data.stats.usage.tokens_7d)}</span>
							<Zap class="h-4 w-4 text-yellow-500" />
						</div>
					</div>
					<Activity class="h-8 w-8 text-muted-foreground" />
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Files Processed -->
		<Card.Root>
			<Card.Content class="p-6">
				<div class="flex items-center justify-between">
					<div class="space-y-1">
						<p class="text-sm font-medium text-muted-foreground">Files</p>
						<div class="flex items-center space-x-2">
							<span class="text-2xl font-bold">{data.stats.files.total_files}</span>
							{#if data.stats.files.processing_queue_size > 0}
								<Badge variant="secondary" class="text-xs">
									{data.stats.files.processing_queue_size} processing
								</Badge>
							{/if}
						</div>
					</div>
					<Upload class="h-8 w-8 text-muted-foreground" />
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Quick Actions -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center space-x-2">
					<Zap class="h-5 w-5" />
					<span>Quick Actions</span>
				</Card.Title>
				<Card.Description>
					Get started with common developer tasks
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#each quickActions as action}
					<div class="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors">
						<div class="flex items-center space-x-3">
							<div class="w-8 h-8 rounded-md {action.color} flex items-center justify-center">
								<svelte:component this={action.icon} class="h-4 w-4 text-white" />
							</div>
							<div>
								<p class="font-medium text-sm">{action.title}</p>
								<p class="text-xs text-muted-foreground">{action.description}</p>
							</div>
						</div>
						<Button size="sm" variant="ghost" href={action.href}>
							<Plus class="h-4 w-4" />
						</Button>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>

		<!-- Recent Activity -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center space-x-2">
					<Activity class="h-5 w-5" />
					<span>Recent Resources</span>
				</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<!-- Recent Prompts -->
				{#if data.stats.prompts.recent.length > 0}
					<div>
						<h4 class="text-sm font-medium mb-2 text-muted-foreground">System Prompts</h4>
						<div class="space-y-2">
							{#each data.stats.prompts.recent as prompt}
								<div class="flex items-center justify-between">
									<div class="flex items-center space-x-2">
										<FileText class="h-4 w-4 text-muted-foreground" />
										<span class="text-sm truncate">{prompt.name}</span>
									</div>
									<Badge variant="outline" class="text-xs">
										{prompt.category}
									</Badge>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Recent Schemas -->
				{#if data.stats.schemas.recent.length > 0}
					<div>
						<h4 class="text-sm font-medium mb-2 text-muted-foreground">Output Schemas</h4>
						<div class="space-y-2">
							{#each data.stats.schemas.recent as schema}
								<div class="flex items-center justify-between">
									<div class="flex items-center space-x-2">
										<Settings class="h-4 w-4 text-muted-foreground" />
										<span class="text-sm truncate">{schema.name}</span>
									</div>
									{#if schema.is_public}
										<Badge variant="secondary" class="text-xs">Public</Badge>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- No recent activity -->
				{#if data.stats.prompts.recent.length === 0 && data.stats.schemas.recent.length === 0}
					<div class="text-center py-8 text-muted-foreground">
						<AlertCircle class="h-8 w-8 mx-auto mb-2" />
						<p class="text-sm">No recent activity</p>
						<p class="text-xs">Start by creating an API key or system prompt</p>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<!-- File Processing Overview -->
	{#if data.stats.files.total_files > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center space-x-2">
					<Upload class="h-5 w-5" />
					<span>File Processing Overview</span>
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<!-- File Types -->
					<div>
						<h4 class="text-sm font-medium mb-2">File Types</h4>
						<div class="space-y-2">
							{#each Object.entries(data.stats.files.by_type) as [type, count]}
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground capitalize">{type}</span>
									<span class="text-sm font-medium">{count}</span>
								</div>
							{/each}
						</div>
					</div>

					<!-- Processing Status -->
					<div>
						<h4 class="text-sm font-medium mb-2">Status</h4>
						<div class="space-y-2">
							{#each Object.entries(data.stats.files.by_status) as [status, count]}
								<div class="flex justify-between">
									<span class="text-sm text-muted-foreground capitalize">{status}</span>
									<span class="text-sm font-medium">{count}</span>
								</div>
							{/each}
						</div>
					</div>

					<!-- Storage Usage -->
					<div>
						<h4 class="text-sm font-medium mb-2">Storage</h4>
						<div class="space-y-2">
							<div class="flex justify-between">
								<span class="text-sm text-muted-foreground">Total Size</span>
								<span class="text-sm font-medium">{formatBytes(data.stats.files.total_size)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-sm text-muted-foreground">Queue Size</span>
								<span class="text-sm font-medium">{data.stats.files.processing_queue_size}</span>
							</div>
						</div>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Getting Started Guide -->
	{#if data.stats.api_keys.total === 0}
		<Card.Root class="border-dashed">
			<Card.Content class="p-8 text-center">
				<Key class="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
				<h3 class="text-lg font-semibold mb-2">Get Started with the API</h3>
				<p class="text-muted-foreground mb-6 max-w-md mx-auto">
					Create your first API key to start building with our AI services. 
					You'll get access to system prompts, structured outputs, and file processing.
				</p>
				<div class="space-x-4">
					<Button href="/developer/keys?action=create" size="lg">
						Create API Key
					</Button>
					<Button href="/docs/features/api-reference" variant="outline" size="lg">
						View Documentation
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
</div>