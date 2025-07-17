<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge';
	import { 
		User, 
		MessageSquare, 
		Settings, 
		Activity,
		Calendar,
		TrendingUp,
		Clock,
		Mail
	} from 'lucide-svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	$: user = data.user;
	$: profile = data.profile;

	// Sample data for dashboard
	const recentActivity = [
		{ id: 1, type: 'chat', title: 'Started conversation about AI', time: '2 hours ago' },
		{ id: 2, type: 'profile', title: 'Updated profile information', time: '1 day ago' },
		{ id: 3, type: 'login', title: 'Logged in from new device', time: '3 days ago' }
	];

	const stats = [
		{ label: 'Total Conversations', value: '12', icon: MessageSquare, color: 'bg-blue-500' },
		{ label: 'Active Sessions', value: '3', icon: Activity, color: 'bg-green-500' },
		{ label: 'Profile Views', value: '47', icon: User, color: 'bg-purple-500' },
		{ label: 'Last Login', value: 'Today', icon: Clock, color: 'bg-orange-500' }
	];
</script>

<svelte:head>
	<title>Dashboard - SvelteKit Accelerator</title>
	<meta name="description" content="Your personal dashboard" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
				<p class="text-muted-foreground">
					Welcome back, {profile?.full_name || user.email}!
				</p>
			</div>
			<div class="flex items-center space-x-4">
				<Button href="/settings" variant="outline">
					<Settings class="h-4 w-4 mr-2" />
					Settings
				</Button>
				<Button href="/chat">
					<MessageSquare class="h-4 w-4 mr-2" />
					Start Chat
				</Button>
			</div>
		</div>
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
		{#each stats as stat}
			<Card.Root>
				<Card.Content class="p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-muted-foreground">
								{stat.label}
							</p>
							<p class="text-2xl font-bold">
								{stat.value}
							</p>
						</div>
						<div class="h-10 w-10 rounded-full {stat.color} flex items-center justify-center">
							<svelte:component this={stat.icon} class="h-5 w-5 text-white" />
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>

	<!-- Main Content Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
		<!-- Profile Card -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center">
					<User class="h-5 w-5 mr-2" />
					Profile Information
				</Card.Title>
				<Card.Description>
					Your account details and preferences
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex items-center space-x-4">
					<div class="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
						<User class="h-8 w-8 text-primary-foreground" />
					</div>
					<div>
						<h3 class="font-semibold">
							{profile?.full_name || 'Anonymous User'}
						</h3>
						<p class="text-sm text-muted-foreground flex items-center">
							<Mail class="h-4 w-4 mr-1" />
							{user.email}
						</p>
						<div class="flex items-center mt-2">
							<Badge variant="secondary">
								{user.email_confirmed_at ? 'Verified' : 'Unverified'}
							</Badge>
						</div>
					</div>
				</div>
				
				{#if profile?.bio}
					<div>
						<h4 class="font-medium mb-2">Bio</h4>
						<p class="text-sm text-muted-foreground">{profile.bio}</p>
					</div>
				{/if}

				<div class="pt-4 border-t">
					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">Member since</span>
						<span>{new Date(user.created_at).toLocaleDateString()}</span>
					</div>
				</div>
			</Card.Content>
			<Card.Footer>
				<Button href="/settings" variant="outline" class="w-full">
					<Settings class="h-4 w-4 mr-2" />
					Edit Profile
				</Button>
			</Card.Footer>
		</Card.Root>

		<!-- Recent Activity -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center">
					<Activity class="h-5 w-5 mr-2" />
					Recent Activity
				</Card.Title>
				<Card.Description>
					Your latest actions and updates
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="space-y-4">
					{#each recentActivity as activity}
						<div class="flex items-center space-x-4">
							<div class="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
								{#if activity.type === 'chat'}
									<MessageSquare class="h-4 w-4" />
								{:else if activity.type === 'profile'}
									<User class="h-4 w-4" />
								{:else}
									<Clock class="h-4 w-4" />
								{/if}
							</div>
							<div class="flex-1">
								<p class="text-sm font-medium">{activity.title}</p>
								<p class="text-xs text-muted-foreground">{activity.time}</p>
							</div>
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Quick Actions -->
	<div class="mt-8">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center">
					<TrendingUp class="h-5 w-5 mr-2" />
					Quick Actions
				</Card.Title>
				<Card.Description>
					Common tasks and shortcuts
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Button href="/chat" class="h-20 flex-col">
						<MessageSquare class="h-6 w-6 mb-2" />
						Start New Chat
					</Button>
					<Button href="/settings" variant="outline" class="h-20 flex-col">
						<Settings class="h-6 w-6 mb-2" />
						Account Settings
					</Button>
					<Button href="/docs" variant="outline" class="h-20 flex-col">
						<Calendar class="h-6 w-6 mb-2" />
						View Documentation
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>