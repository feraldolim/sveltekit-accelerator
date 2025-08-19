<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { 
		Key, 
		FileText, 
		Settings, 
		BarChart3, 
		Upload, 
		MessageSquare,
		Code2,
		ArrowLeft
	} from 'lucide-svelte';
	import type { LayoutData } from './$types';

	let { data }: { data: LayoutData } = $props();

	const navItems = [
		{
			href: '/developer',
			label: 'Overview',
			icon: BarChart3,
			exact: true
		},
		{
			href: '/developer/keys',
			label: 'API Keys',
			icon: Key,
			badge: 'Core'
		},
		{
			href: '/developer/prompts',
			label: 'System Prompts',
			icon: FileText
		},
		{
			href: '/developer/schemas',
			label: 'Structured Outputs',
			icon: Settings
		},
		{
			href: '/developer/files',
			label: 'File Analytics',
			icon: Upload,
			badge: 'Soon'
		},
		{
			href: '/developer/conversations',
			label: 'Conversations',
			icon: MessageSquare
		}
	];

	function isActive(href: string, exact = false): boolean {
		if (exact) {
			return $page.url.pathname === href;
		}
		return $page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<title>Developer Console - SvelteKit Accelerator</title>
	<meta name="description" content="Manage your API keys, prompts, and integrations" />
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
		<div class="container mx-auto px-4">
			<div class="flex h-16 items-center justify-between">
				<div class="flex items-center space-x-4">
					<Button variant="ghost" size="sm" href="/" class="flex items-center space-x-2">
						<ArrowLeft class="h-4 w-4" />
						<span>Back to App</span>
					</Button>
					<div class="flex items-center space-x-2">
						<Code2 class="h-6 w-6 text-primary" />
						<div>
							<h1 class="text-xl font-bold">Developer Console</h1>
							<p class="text-xs text-muted-foreground">API Management & Analytics</p>
						</div>
					</div>
				</div>
				
				<div class="flex items-center space-x-4">
					<Badge variant="secondary" class="hidden sm:flex">
						{data.user.email}
					</Badge>
				</div>
			</div>
		</div>
	</header>

	<div class="container mx-auto px-4 py-6">
		<div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
			<!-- Sidebar Navigation -->
			<aside class="lg:col-span-1">
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm font-medium">Navigation</Card.Title>
					</Card.Header>
					<Card.Content class="p-0">
						<nav class="space-y-1">
							{#each navItems as item}
								<a
									href={item.href}
									class="flex items-center justify-between px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground {isActive(item.href, item.exact) ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'}"
								>
									<div class="flex items-center space-x-2">
										<svelte:component this={item.icon} class="h-4 w-4" />
										<span>{item.label}</span>
									</div>
									{#if item.badge}
										<Badge variant="secondary" class="text-xs">
											{item.badge}
										</Badge>
									{/if}
								</a>
							{/each}
						</nav>
					</Card.Content>
				</Card.Root>

				<!-- Quick Stats -->
				<div class="mt-6 space-y-2">
					<Card.Root>
						<Card.Content class="p-4">
							<div class="text-center">
								<div class="text-2xl font-bold text-primary">API v1</div>
								<div class="text-xs text-muted-foreground">Current Version</div>
							</div>
						</Card.Content>
					</Card.Root>
				</div>
			</aside>

			<!-- Main Content -->
			<main class="lg:col-span-4">
				<slot />
			</main>
		</div>
	</div>
</div>

<style>
	/* Custom scrollbar for sidebar */
	nav {
		scrollbar-width: thin;
		scrollbar-color: hsl(var(--muted)) transparent;
	}
	
	nav::-webkit-scrollbar {
		width: 4px;
	}
	
	nav::-webkit-scrollbar-track {
		background: transparent;
	}
	
	nav::-webkit-scrollbar-thumb {
		background: hsl(var(--muted));
		border-radius: 2px;
	}
</style>