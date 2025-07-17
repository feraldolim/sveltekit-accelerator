<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Menu, X, User, LogOut, Settings } from 'lucide-svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();

	let mobileMenuOpen = $state(false);

	// Use server-side auth data
	const user = $derived(data.user);
	const session = $derived(data.session);

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<div class="min-h-screen bg-background">
	<!-- Navigation -->
	<header class="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
		<div class="container mx-auto px-4">
			<div class="flex h-16 items-center justify-between">
				<!-- Logo -->
				<div class="flex items-center space-x-4">
					<a href="/" class="flex items-center space-x-2">
						<div class="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
							<span class="text-primary-foreground font-bold text-sm">SA</span>
						</div>
						<span class="font-bold text-xl hidden sm:block">SvelteKit Accelerator</span>
					</a>
				</div>

				<!-- Desktop Navigation -->
				<nav class="hidden md:flex items-center space-x-6">
					<a 
						href="/" 
						class="text-sm font-medium hover:text-primary transition-colors"
						class:text-primary={$page.route.id === '/'}
					>
						Home
					</a>
					{#if user}
						<a 
							href="/dashboard" 
							class="text-sm font-medium hover:text-primary transition-colors"
							class:text-primary={$page.route.id?.startsWith('/dashboard')}
						>
							Dashboard
						</a>
						<a 
							href="/chat" 
							class="text-sm font-medium hover:text-primary transition-colors"
							class:text-primary={$page.route.id?.includes('chat')}
						>
							Chat
						</a>
					{/if}
					<a 
						href="/docs" 
						class="text-sm font-medium hover:text-primary transition-colors"
						class:text-primary={$page.route.id?.includes('docs')}
					>
						Docs
					</a>
				</nav>

				<!-- Desktop Auth -->
				<div class="hidden md:flex items-center space-x-4">
					{#if user}
						<div class="flex items-center space-x-2">
							<Button variant="ghost" size="sm" href="/settings">
								<Settings class="h-4 w-4 mr-2" />
								Settings
							</Button>
							<form method="POST" action="/auth/logout" style="display: inline;">
								<Button variant="ghost" size="sm" type="submit">
									<LogOut class="h-4 w-4 mr-2" />
									Sign Out
								</Button>
							</form>
							<div class="flex items-center space-x-2 pl-2 border-l border-border">
								<div class="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
									<User class="h-4 w-4 text-primary-foreground" />
								</div>
								<span class="text-sm font-medium">{user.email}</span>
							</div>
						</div>
					{:else}
						<Button variant="ghost" size="sm" href="/auth/login">
							Sign In
						</Button>
						<Button size="sm" href="/auth/signup">
							Get Started
						</Button>
					{/if}
				</div>

				<!-- Mobile menu button -->
				<div class="md:hidden">
					<Button
						variant="ghost"
						size="sm"
						onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
					>
						{#if mobileMenuOpen}
							<X class="h-6 w-6" />
						{:else}
							<Menu class="h-6 w-6" />
						{/if}
					</Button>
				</div>
			</div>
		</div>

		<!-- Mobile Navigation -->
		{#if mobileMenuOpen}
			<div class="md:hidden border-t border-border">
				<div class="px-4 py-2 space-y-1">
					<a 
						href="/" 
						class="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-md"
						class:bg-muted={$page.route.id === '/'}
						onclick={closeMobileMenu}
					>
						Home
					</a>
					{#if user}
						<a 
							href="/dashboard" 
							class="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-md"
							class:bg-muted={$page.route.id?.startsWith('/dashboard')}
							onclick={closeMobileMenu}
						>
							Dashboard
						</a>
						<a 
							href="/chat" 
							class="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-md"
							class:bg-muted={$page.route.id?.includes('chat')}
							onclick={closeMobileMenu}
						>
							Chat
						</a>
					{/if}
					<a 
						href="/docs" 
						class="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-md"
						class:bg-muted={$page.route.id?.includes('docs')}
						onclick={closeMobileMenu}
					>
						Docs
					</a>
					
					{#if user}
						<div class="border-t border-border pt-2 mt-2">
							<div class="px-3 py-2 text-sm text-muted-foreground">
								{user.email}
							</div>
							<a 
								href="/settings" 
								class="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-md"
								onclick={closeMobileMenu}
							>
								Settings
							</a>
							<form method="POST" action="/auth/logout" style="display: block;">
								<button 
									class="block w-full text-left px-3 py-2 text-sm font-medium hover:bg-muted rounded-md"
									type="submit"
								>
									Sign Out
								</button>
							</form>
						</div>
					{:else}
						<div class="border-t border-border pt-2 mt-2 space-y-1">
							<a 
								href="/auth/login" 
								class="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-md"
								onclick={closeMobileMenu}
							>
								Sign In
							</a>
							<a 
								href="/auth/signup" 
								class="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-md"
								onclick={closeMobileMenu}
							>
								Get Started
							</a>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</header>

	<!-- Main Content -->
	<main>
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="border-t border-border bg-muted/50">
		<div class="container mx-auto px-4 py-8">
			<div class="grid grid-cols-1 md:grid-cols-4 gap-8">
				<div class="space-y-3">
					<div class="flex items-center space-x-2">
						<div class="h-6 w-6 rounded bg-primary flex items-center justify-center">
							<span class="text-primary-foreground font-bold text-xs">SA</span>
						</div>
						<span class="font-bold">SvelteKit Accelerator</span>
					</div>
					<p class="text-sm text-muted-foreground">
						A modern, production-ready boilerplate for building full-stack web applications.
					</p>
				</div>
				
				<div>
					<h3 class="font-semibold mb-3">Product</h3>
					<ul class="space-y-2 text-sm">
						<li><a href="/features" class="text-muted-foreground hover:text-foreground">Features</a></li>
						<li><a href="/docs" class="text-muted-foreground hover:text-foreground">Documentation</a></li>
						<li><a href="/examples" class="text-muted-foreground hover:text-foreground">Examples</a></li>
					</ul>
				</div>
				
				<div>
					<h3 class="font-semibold mb-3">Resources</h3>
					<ul class="space-y-2 text-sm">
						<li><a href="/blog" class="text-muted-foreground hover:text-foreground">Blog</a></li>
						<li><a href="/community" class="text-muted-foreground hover:text-foreground">Community</a></li>
						<li><a href="/support" class="text-muted-foreground hover:text-foreground">Support</a></li>
					</ul>
				</div>
				
				<div>
					<h3 class="font-semibold mb-3">Legal</h3>
					<ul class="space-y-2 text-sm">
						<li><a href="/privacy" class="text-muted-foreground hover:text-foreground">Privacy Policy</a></li>
						<li><a href="/terms" class="text-muted-foreground hover:text-foreground">Terms of Service</a></li>
						<li><a href="/cookies" class="text-muted-foreground hover:text-foreground">Cookie Policy</a></li>
					</ul>
				</div>
			</div>
			
			<div class="border-t border-border pt-8 mt-8 flex flex-col sm:flex-row justify-between items-center">
				<p class="text-sm text-muted-foreground">
					© 2025 SvelteKit Accelerator. All rights reserved.
				</p>
				<div class="flex items-center space-x-4 mt-4 sm:mt-0">
					<a href="https://github.com/yourusername/sveltekit-accelerator" class="text-muted-foreground hover:text-foreground">
						<span class="sr-only">GitHub</span>
						<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd" />
						</svg>
					</a>
				</div>
			</div>
		</div>
	</footer>
</div>
