<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from "$lib/components/ui/card/index.js";
	import { Badge } from '$lib/components/ui/badge';
	import { 
		Zap, 
		Shield, 
		Database, 
		Bot, 
		Cloud, 
		Palette, 
		Code, 
		GitBranch,
		Rocket,
		Star,
		ArrowRight,
		Check
	} from 'lucide-svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	const features = [
		{
			icon: Palette,
			title: 'shadcn-svelte UI',
			description: 'Beautiful, accessible components built with Tailwind CSS and Radix primitives.',
			highlight: 'Pre-configured'
		},
		{
			icon: Bot,
			title: 'AI/LLM Integration',
			description: 'OpenRouter API integration for seamless AI-powered features.',
			highlight: 'Ready to use'
		},
		{
			icon: Shield,
			title: 'Authentication',
			description: 'Supabase Auth with email, OAuth, and session management.',
			highlight: 'Secure'
		},
		{
			icon: Database,
			title: 'Database & Storage',
			description: 'PostgreSQL database and file storage with Supabase.',
			highlight: 'Scalable'
		},
		{
			icon: Cloud,
			title: 'Cloudflare Pages',
			description: 'Deploy instantly to Cloudflare\'s global edge network.',
			highlight: 'Fast'
		},
		{
			icon: Code,
			title: 'TypeScript',
			description: 'Full type safety with TypeScript throughout the application.',
			highlight: 'Type-safe'
		}
	];

	const techStack = [
		'SvelteKit', 'TypeScript', 'Tailwind CSS', 'shadcn-svelte', 
		'Supabase', 'OpenRouter', 'Cloudflare Pages', 'Lucide Icons'
	];
</script>

<svelte:head>
	<title>SvelteKit Accelerator - Modern Full-Stack Boilerplate</title>
	<meta name="description" content="A production-ready SvelteKit boilerplate with AI integration, authentication, and cloud deployment." />
</svelte:head>

<!-- Hero Section -->
<section class="relative overflow-hidden bg-gradient-to-br from-background via-background to-muted py-20 sm:py-32">
	<div class="container mx-auto px-4">
		<div class="text-center max-w-4xl mx-auto">
			<div class="flex justify-center mb-6">
				<Badge variant="secondary" class="px-4 py-2">
					<Star class="h-4 w-4 mr-2" />
					Production Ready
				</Badge>
			</div>
			
			<h1 class="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
				Ship Faster with
				<span class="text-primary">SvelteKit Accelerator</span>
			</h1>
			
			<p class="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
				A modern, production-ready boilerplate combining SvelteKit, AI integration, authentication, 
				and cloud deployment. Everything you need to build and scale your next application.
			</p>
			
			<div class="flex flex-col sm:flex-row gap-4 justify-center">
				{#if data.user}
					<Button size="lg" href="/dashboard" class="text-lg px-8">
						<Rocket class="mr-2 h-5 w-5" />
						Go to Dashboard
					</Button>
					<Button variant="outline" size="lg" href="/chat" class="text-lg px-8">
						Try AI Chat
						<ArrowRight class="ml-2 h-5 w-5" />
					</Button>
				{:else}
					<Button size="lg" href="/auth/signup" class="text-lg px-8">
						<Rocket class="mr-2 h-5 w-5" />
						Get Started Free
					</Button>
					<Button variant="outline" size="lg" href="/docs" class="text-lg px-8">
						View Documentation
						<ArrowRight class="ml-2 h-5 w-5" />
					</Button>
				{/if}
			</div>
		</div>
	</div>
</section>

<!-- Features Section -->
<section class="py-20 bg-muted/30">
	<div class="container mx-auto px-4">
		<div class="text-center mb-16">
			<h2 class="text-3xl sm:text-4xl font-bold mb-4">Everything You Need</h2>
			<p class="text-xl text-muted-foreground max-w-2xl mx-auto">
				Built with modern technologies and best practices to help you ship faster.
			</p>
		</div>
		
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
			{#each features as feature}
				<Card.Root class="p-6 hover:shadow-lg transition-shadow">
					<Card.Content class="p-0">
						<div class="flex items-start space-x-4">
							<div class="p-2 bg-primary/10 rounded-lg">
								<svelte:component this={feature.icon} class="h-6 w-6 text-primary" />
							</div>
							<div class="flex-1">
								<div class="flex items-center space-x-2 mb-2">
									<h3 class="font-semibold text-lg">{feature.title}</h3>
									<Badge variant="outline" class="text-xs">{feature.highlight}</Badge>
								</div>
								<p class="text-muted-foreground">{feature.description}</p>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	</div>
</section>

<!-- Tech Stack Section -->
<section class="py-20">
	<div class="container mx-auto px-4">
		<div class="text-center mb-16">
			<h2 class="text-3xl sm:text-4xl font-bold mb-4">Built With Modern Tech</h2>
			<p class="text-xl text-muted-foreground">
				Leveraging the best tools and frameworks in the ecosystem.
			</p>
		</div>
		
		<div class="flex flex-wrap justify-center gap-4 mb-12">
			{#each techStack as tech}
				<Badge variant="secondary" class="px-4 py-2 text-sm">
					{tech}
				</Badge>
			{/each}
		</div>
		
		<div class="max-w-3xl mx-auto">
			<Card.Root class="p-8">
				<Card.Content class="p-0">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
						<div>
							<h3 class="font-semibold text-lg mb-4 flex items-center">
								<Zap class="h-5 w-5 mr-2 text-primary" />
								What's Included
							</h3>
							<ul class="space-y-3">
								<li class="flex items-center">
									<Check class="h-4 w-4 text-green-500 mr-3" />
									<span class="text-sm">Complete authentication system</span>
								</li>
								<li class="flex items-center">
									<Check class="h-4 w-4 text-green-500 mr-3" />
									<span class="text-sm">AI/LLM API integration</span>
								</li>
								<li class="flex items-center">
									<Check class="h-4 w-4 text-green-500 mr-3" />
									<span class="text-sm">Database & storage setup</span>
								</li>
								<li class="flex items-center">
									<Check class="h-4 w-4 text-green-500 mr-3" />
									<span class="text-sm">UI component library</span>
								</li>
								<li class="flex items-center">
									<Check class="h-4 w-4 text-green-500 mr-3" />
									<span class="text-sm">Deployment configuration</span>
								</li>
							</ul>
						</div>
						
						<div>
							<h3 class="font-semibold text-lg mb-4 flex items-center">
								<GitBranch class="h-5 w-5 mr-2 text-primary" />
								Developer Experience
							</h3>
							<ul class="space-y-3">
								<li class="flex items-center">
									<Check class="h-4 w-4 text-green-500 mr-3" />
									<span class="text-sm">TypeScript everywhere</span>
								</li>
								<li class="flex items-center">
									<Check class="h-4 w-4 text-green-500 mr-3" />
									<span class="text-sm">ESLint & Prettier configured</span>
								</li>
								<li class="flex items-center">
									<Check class="h-4 w-4 text-green-500 mr-3" />
									<span class="text-sm">Comprehensive documentation</span>
								</li>
								<li class="flex items-center">
									<Check class="h-4 w-4 text-green-500 mr-3" />
									<span class="text-sm">Example implementations</span>
								</li>
								<li class="flex items-center">
									<Check class="h-4 w-4 text-green-500 mr-3" />
									<span class="text-sm">Production optimized</span>
								</li>
							</ul>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</section>

<!-- CTA Section -->
<section class="py-20 bg-primary text-primary-foreground">
	<div class="container mx-auto px-4 text-center">
		<h2 class="text-3xl sm:text-4xl font-bold mb-4">Ready to Build Something Amazing?</h2>
		<p class="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
			Join developers who are shipping faster with SvelteKit Accelerator.
		</p>
		
		<div class="flex flex-col sm:flex-row gap-4 justify-center">
			{#if data.user}
				<Button variant="secondary" size="lg" href="/dashboard" class="text-lg px-8">
					<Rocket class="mr-2 h-5 w-5" />
					Continue Building
				</Button>
			{:else}
				<Button variant="secondary" size="lg" href="/auth/signup" class="text-lg px-8">
					<Rocket class="mr-2 h-5 w-5" />
					Start Building Now
				</Button>
				<Button variant="outline" size="lg" href="/auth/login" class="text-lg px-8 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground hover:text-primary">
					Sign In
				</Button>
			{/if}
		</div>
	</div>
</section>
