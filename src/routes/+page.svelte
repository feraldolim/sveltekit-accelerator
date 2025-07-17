<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
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
			description: "Deploy instantly to Cloudflare's global edge network.",
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
		'SvelteKit',
		'TypeScript',
		'Tailwind CSS',
		'shadcn-svelte',
		'Supabase',
		'OpenRouter',
		'Cloudflare Pages',
		'Lucide Icons'
	];
</script>

<svelte:head>
	<title>SvelteKit Accelerator - Modern Full-Stack Boilerplate</title>
	<meta
		name="description"
		content="A production-ready SvelteKit boilerplate with AI integration, authentication, and cloud deployment."
	/>
</svelte:head>

<!-- Hero Section -->
<section
	class="from-background via-background to-muted relative overflow-hidden bg-gradient-to-br py-20 sm:py-32"
>
	<div class="container mx-auto px-4">
		<div class="mx-auto max-w-4xl text-center">
			<div class="mb-6 flex justify-center">
				<Badge variant="secondary" class="px-4 py-2">
					<Star class="mr-2 h-4 w-4" />
					Production Ready
				</Badge>
			</div>

			<h1 class="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
				Ship Faster with
				<span class="text-primary">SvelteKit Accelerator</span>
			</h1>

			<p class="text-muted-foreground mx-auto mb-8 max-w-2xl text-xl">
				A modern, production-ready boilerplate combining SvelteKit, AI integration, authentication,
				and cloud deployment. Everything you need to build and scale your next application.
			</p>

			<div class="flex flex-col justify-center gap-4 sm:flex-row">
				{#if data.user}
					<Button size="lg" href="/dashboard" class="px-8 text-lg">
						<Rocket class="mr-2 h-5 w-5" />
						Go to Dashboard
					</Button>
					<Button variant="outline" size="lg" href="/chat" class="px-8 text-lg">
						Try AI Chat
						<ArrowRight class="ml-2 h-5 w-5" />
					</Button>
				{:else}
					<Button size="lg" href="/auth/signup" class="px-8 text-lg">
						<Rocket class="mr-2 h-5 w-5" />
						Get Started Free
					</Button>
					<Button variant="outline" size="lg" href="/docs" class="px-8 text-lg">
						View Documentation
						<ArrowRight class="ml-2 h-5 w-5" />
					</Button>
				{/if}
			</div>
		</div>
	</div>
</section>

<!-- Features Section -->
<section class="bg-muted/30 py-20">
	<div class="container mx-auto px-4">
		<div class="mb-16 text-center">
			<h2 class="mb-4 text-3xl font-bold sm:text-4xl">Everything You Need</h2>
			<p class="text-muted-foreground mx-auto max-w-2xl text-xl">
				Built with modern technologies and best practices to help you ship faster.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
			{#each features as feature}
				<Card.Root class="p-6 transition-shadow hover:shadow-lg">
					<Card.Content class="p-0">
						<div class="flex items-start space-x-4">
							<div class="bg-primary/10 rounded-lg p-2">
								<svelte:component this={feature.icon} class="text-primary h-6 w-6" />
							</div>
							<div class="flex-1">
								<div class="mb-2 flex items-center space-x-2">
									<h3 class="text-lg font-semibold">{feature.title}</h3>
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
		<div class="mb-16 text-center">
			<h2 class="mb-4 text-3xl font-bold sm:text-4xl">Built With Modern Tech</h2>
			<p class="text-muted-foreground text-xl">
				Leveraging the best tools and frameworks in the ecosystem.
			</p>
		</div>

		<div class="mb-12 flex flex-wrap justify-center gap-4">
			{#each techStack as tech}
				<Badge variant="secondary" class="px-4 py-2 text-sm">
					{tech}
				</Badge>
			{/each}
		</div>

		<div class="mx-auto max-w-3xl">
			<Card.Root class="p-8">
				<Card.Content class="p-0">
					<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
						<div>
							<h3 class="mb-4 flex items-center text-lg font-semibold">
								<Zap class="text-primary mr-2 h-5 w-5" />
								What's Included
							</h3>
							<ul class="space-y-3">
								<li class="flex items-center">
									<Check class="mr-3 h-4 w-4 text-green-500" />
									<span class="text-sm">Complete authentication system</span>
								</li>
								<li class="flex items-center">
									<Check class="mr-3 h-4 w-4 text-green-500" />
									<span class="text-sm">AI/LLM API integration</span>
								</li>
								<li class="flex items-center">
									<Check class="mr-3 h-4 w-4 text-green-500" />
									<span class="text-sm">Database & storage setup</span>
								</li>
								<li class="flex items-center">
									<Check class="mr-3 h-4 w-4 text-green-500" />
									<span class="text-sm">UI component library</span>
								</li>
								<li class="flex items-center">
									<Check class="mr-3 h-4 w-4 text-green-500" />
									<span class="text-sm">Deployment configuration</span>
								</li>
							</ul>
						</div>

						<div>
							<h3 class="mb-4 flex items-center text-lg font-semibold">
								<GitBranch class="text-primary mr-2 h-5 w-5" />
								Developer Experience
							</h3>
							<ul class="space-y-3">
								<li class="flex items-center">
									<Check class="mr-3 h-4 w-4 text-green-500" />
									<span class="text-sm">TypeScript everywhere</span>
								</li>
								<li class="flex items-center">
									<Check class="mr-3 h-4 w-4 text-green-500" />
									<span class="text-sm">ESLint & Prettier configured</span>
								</li>
								<li class="flex items-center">
									<Check class="mr-3 h-4 w-4 text-green-500" />
									<span class="text-sm">Comprehensive documentation</span>
								</li>
								<li class="flex items-center">
									<Check class="mr-3 h-4 w-4 text-green-500" />
									<span class="text-sm">Example implementations</span>
								</li>
								<li class="flex items-center">
									<Check class="mr-3 h-4 w-4 text-green-500" />
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
<section class="bg-primary text-primary-foreground py-20">
	<div class="container mx-auto px-4 text-center">
		<h2 class="mb-4 text-3xl font-bold sm:text-4xl">Ready to Build Something Amazing?</h2>
		<p class="mx-auto mb-8 max-w-2xl text-xl opacity-90">
			Join developers who are shipping faster with SvelteKit Accelerator.
		</p>

		<div class="flex flex-col justify-center gap-4 sm:flex-row">
			{#if data.user}
				<Button variant="secondary" size="lg" href="/dashboard" class="px-8 text-lg">
					<Rocket class="mr-2 h-5 w-5" />
					Continue Building
				</Button>
			{:else}
				<Button variant="secondary" size="lg" href="/auth/signup" class="px-8 text-lg">
					<Rocket class="mr-2 h-5 w-5" />
					Start Building Now
				</Button>
				<Button
					variant="outline"
					size="lg"
					href="/auth/login"
					class="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground hover:text-primary px-8 text-lg"
				>
					Sign In
				</Button>
			{/if}
		</div>
	</div>
</section>
