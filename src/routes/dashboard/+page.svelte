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
	$: dashboardStats = data.stats;

	// Format numbers for display
	function formatNumber(num: number): string {
		if (num >= 1000000) {
			return (num / 1000000).toFixed(1) + 'M';
		} else if (num >= 1000) {
			return (num / 1000).toFixed(1) + 'K';
		}
		return num.toString();
	}

	// Format file size
	function formatFileSize(bytes: number): string {
		if (bytes >= 1024 * 1024 * 1024) {
			return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
		} else if (bytes >= 1024 * 1024) {
			return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
		} else if (bytes >= 1024) {
			return (bytes / 1024).toFixed(1) + ' KB';
		}
		return bytes + ' B';
	}

	// Format relative time
	function formatRelativeTime(date: Date): string {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `${days} day${days > 1 ? 's' : ''} ago`;
		} else if (hours > 0) {
			return `${hours} hour${hours > 1 ? 's' : ''} ago`;
		} else if (minutes > 0) {
			return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
		} else {
			return 'Just now';
		}
	}

	// Create stats array from real data
	$: stats = [
		{
			label: 'Total Conversations',
			value: formatNumber(dashboardStats?.totalChats || 0),
			icon: MessageSquare,
			color: 'bg-blue-500'
		},
		{
			label: 'Messages Sent',
			value: formatNumber(dashboardStats?.totalMessages || 0),
			icon: Activity,
			color: 'bg-green-500'
		},
		{
			label: 'API Calls',
			value: formatNumber(dashboardStats?.apiUsage?.total || 0),
			icon: Settings,
			color: 'bg-purple-500'
		},
		{
			label: 'Storage Used',
			value: formatFileSize(dashboardStats?.storageUsage?.totalSize || 0),
			icon: Clock,
			color: 'bg-orange-500'
		}
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
					<Settings class="mr-2 h-4 w-4" />
					Settings
				</Button>
				<Button href="/chat">
					<MessageSquare class="mr-2 h-4 w-4" />
					Start Chat
				</Button>
			</div>
		</div>
	</div>

	<!-- Stats Grid -->
	<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
		{#each stats as stat}
			<Card.Root>
				<Card.Content class="p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-muted-foreground text-sm font-medium">
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
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<!-- Profile Card -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center">
					<User class="mr-2 h-5 w-5" />
					Profile Information
				</Card.Title>
				<Card.Description>Your account details and preferences</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex items-center space-x-4">
					<div class="bg-primary flex h-16 w-16 items-center justify-center rounded-full">
						<User class="text-primary-foreground h-8 w-8" />
					</div>
					<div>
						<h3 class="font-semibold">
							{profile?.full_name || 'Anonymous User'}
						</h3>
						<p class="text-muted-foreground flex items-center text-sm">
							<Mail class="mr-1 h-4 w-4" />
							{user.email}
						</p>
						<div class="mt-2 flex items-center">
							<Badge variant="secondary">
								{user.email_confirmed_at ? 'Verified' : 'Unverified'}
							</Badge>
						</div>
					</div>
				</div>

				{#if profile?.bio}
					<div>
						<h4 class="mb-2 font-medium">Bio</h4>
						<p class="text-muted-foreground text-sm">{profile.bio}</p>
					</div>
				{/if}

				<div class="border-t pt-4">
					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">Member since</span>
						<span>{new Date(user.created_at).toLocaleDateString()}</span>
					</div>
				</div>
			</Card.Content>
			<Card.Footer>
				<Button href="/settings" variant="outline" class="w-full">
					<Settings class="mr-2 h-4 w-4" />
					Edit Profile
				</Button>
			</Card.Footer>
		</Card.Root>

		<!-- Recent Activity -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center">
					<Activity class="mr-2 h-5 w-5" />
					Recent Activity
				</Card.Title>
				<Card.Description>Your latest actions and updates</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="space-y-4">
					{#if dashboardStats?.recentActivity?.length > 0}
						{#each dashboardStats.recentActivity as activity}
							<div class="flex items-center space-x-4">
								<div class="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
									{#if activity.type === 'chat'}
										<MessageSquare class="h-4 w-4" />
									{:else if activity.type === 'api'}
										<Settings class="h-4 w-4" />
									{:else if activity.type === 'storage'}
										<Calendar class="h-4 w-4" />
									{:else}
										<Clock class="h-4 w-4" />
									{/if}
								</div>
								<div class="flex-1">
									<p class="text-sm font-medium">{activity.details}</p>
									<p class="text-muted-foreground text-xs">
										{formatRelativeTime(activity.timestamp)}
									</p>
								</div>
							</div>
						{/each}
					{:else}
						<div class="text-muted-foreground py-8 text-center">
							<Activity class="mx-auto mb-2 h-8 w-8 opacity-50" />
							<p class="text-sm">No recent activity</p>
						</div>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Quick Actions -->
	<div class="mt-8">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center">
					<TrendingUp class="mr-2 h-5 w-5" />
					Quick Actions
				</Card.Title>
				<Card.Description>Common tasks and shortcuts</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<Button href="/chat" class="h-20 flex-col">
						<MessageSquare class="mb-2 h-6 w-6" />
						Start New Chat
					</Button>
					<Button href="/settings" variant="outline" class="h-20 flex-col">
						<Settings class="mb-2 h-6 w-6" />
						Account Settings
					</Button>
					<Button href="/docs" variant="outline" class="h-20 flex-col">
						<Calendar class="mb-2 h-6 w-6" />
						View Documentation
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
