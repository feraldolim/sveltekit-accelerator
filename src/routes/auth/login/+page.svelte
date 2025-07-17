<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Alert from "$lib/components/ui/alert/index.js";
	import { Separator } from '$lib/components/ui/separator';
	import { Eye, EyeOff, Github, Mail } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';
	import { isValidEmail } from '$lib/utils';

	export let data: PageData;
	export let form: ActionData;

	let loading = false;
	let showPassword = false;
	let email = form?.email || '';
	let password = '';

	function handleSubmit() {
		loading = true;
	}
</script>

<svelte:head>
	<title>Sign In - SvelteKit Accelerator</title>
	<meta name="description" content="Sign in to your account" />
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-background px-4 py-12">
	<div class="w-full max-w-md space-y-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="text-3xl font-bold tracking-tight">Welcome back</h1>
			<p class="text-muted-foreground mt-2">Sign in to your account to continue</p>
		</div>

		<!-- Main Card -->
		<Card.Root class="p-6">
			<Card.Content class="space-y-6 p-0">
				<!-- OAuth Buttons -->
				<div class="space-y-3">
					<form method="POST" action="?/oauth">
						<input type="hidden" name="provider" value="google" />
						{#if data.redirectTo}
							<input type="hidden" name="redirectTo" value={data.redirectTo} />
						{/if}
						<Button variant="outline" class="w-full" type="submit">
							<Mail class="mr-2 h-4 w-4" />
							Continue with Google
						</Button>
					</form>

					<form method="POST" action="?/oauth">
						<input type="hidden" name="provider" value="github" />
						{#if data.redirectTo}
							<input type="hidden" name="redirectTo" value={data.redirectTo} />
						{/if}
						<Button variant="outline" class="w-full" type="submit">
							<Github class="mr-2 h-4 w-4" />
							Continue with GitHub
						</Button>
					</form>
				</div>

				<div class="relative">
					<div class="absolute inset-0 flex items-center">
						<Separator class="w-full" />
					</div>
					<div class="relative flex justify-center text-xs uppercase">
						<span class="bg-background px-2 text-muted-foreground">Or continue with email</span>
					</div>
				</div>

				<!-- Email/Password Form -->
				<form 
					method="POST" 
					action="?/login"
					use:enhance={() => {
						loading = true;
						return ({ update }) => {
							loading = false;
							update();
						};
					}}
					class="space-y-4"
				>
					{#if data.redirectTo}
						<input type="hidden" name="redirectTo" value={data.redirectTo} />
					{/if}

					<!-- Error Alert -->
					<!-- Success Alert -->
					{#if data.success}
						<Alert.Root variant="default" class="border-green-200 bg-green-50">
							<Alert.Description class="text-green-800">
								{data.success}
							</Alert.Description>
						</Alert.Root>
					{/if}

					<!-- Error Alert -->
					{#if form?.error || data.error}
						<Alert.Root variant="destructive">
							<Alert.Description>{form?.error || data.error}</Alert.Description>
						</Alert.Root>
					{/if}

					<!-- Message Alert -->
					{#if data.message}
						<Alert.Root variant="default">
							<Alert.Description>{data.message}</Alert.Description>
						</Alert.Root>
					{/if}

					<!-- Email Field -->
					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input
							id="email"
							name="email"
							type="email"
							placeholder="Enter your email"
							bind:value={email}
							required
							disabled={loading}
						/>
					</div>

					<!-- Password Field -->
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<Label for="password">Password</Label>
							<a 
								href="/auth/reset-password" 
								class="text-sm text-primary hover:underline"
							>
								Forgot password?
							</a>
						</div>
						<div class="relative">
							<Input
								id="password"
								name="password"
								type={showPassword ? 'text' : 'password'}
								placeholder="Enter your password"
								bind:value={password}
								class="pr-10"
								required
								disabled={loading}
							/>
							<button
								type="button"
								class="absolute inset-y-0 right-0 flex items-center pr-3"
								onclick={() => showPassword = !showPassword}
							>
								{#if showPassword}
									<EyeOff class="h-4 w-4 text-muted-foreground" />
								{:else}
									<Eye class="h-4 w-4 text-muted-foreground" />
								{/if}
							</button>
						</div>
					</div>

					<!-- Submit Button -->
					<Button type="submit" class="w-full" disabled={loading}>
						{#if loading}
							<div class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
							Signing in...
						{:else}
							Sign in
						{/if}
					</Button>
				</form>

				<!-- Sign Up Link -->
				<div class="text-center text-sm">
					<span class="text-muted-foreground">Don't have an account?</span>
					<a 
						href="/auth/signup{data.redirectTo ? `?redirectTo=${encodeURIComponent(data.redirectTo)}` : ''}"
						class="text-primary hover:underline font-medium"
					>
						Sign up
					</a>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Footer -->
		<div class="text-center">
			<p class="text-xs text-muted-foreground">
				By signing in, you agree to our 
				<a href="/terms" class="hover:underline">Terms of Service</a>
				and 
				<a href="/privacy" class="hover:underline">Privacy Policy</a>
			</p>
		</div>
	</div>
</div> 