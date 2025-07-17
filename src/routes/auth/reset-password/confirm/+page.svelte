<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Eye, EyeOff, Key } from 'lucide-svelte';
	import type { ActionData } from './$types';

	export let form: ActionData;

	let loading = false;
	let showPassword = false;
	let showConfirmPassword = false;
	let password = '';
	let confirmPassword = '';
	let passwordError = '';
	let confirmPasswordError = '';

	function validateForm() {
		passwordError = '';
		confirmPasswordError = '';

		if (!password) {
			passwordError = 'Password is required';
		} else if (password.length < 8) {
			passwordError = 'Password must be at least 8 characters long';
		}

		if (!confirmPassword) {
			confirmPasswordError = 'Please confirm your password';
		} else if (password !== confirmPassword) {
			confirmPasswordError = 'Passwords do not match';
		}

		return !passwordError && !confirmPasswordError;
	}

	function handleSubmit() {
		if (!validateForm()) {
			return false;
		}
		loading = true;
		return true;
	}
</script>

<svelte:head>
	<title>Set New Password - SvelteKit Accelerator</title>
	<meta name="description" content="Set your new password" />
</svelte:head>

<div class="bg-background flex min-h-screen items-center justify-center px-4 py-12">
	<div class="w-full max-w-md space-y-8">
		<!-- Header -->
		<div class="text-center">
			<div
				class="bg-primary/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
			>
				<Key class="text-primary h-6 w-6" />
			</div>
			<h1 class="text-3xl font-bold tracking-tight">Set new password</h1>
			<p class="text-muted-foreground mt-2">Enter your new password below</p>
		</div>

		<!-- Main Card -->
		<Card.Root class="p-6">
			{#snippet children()}
				<div class="space-y-6">
					<!-- Password Reset Form -->
					<form
						method="POST"
						action="?/confirm"
						use:enhance={() => {
							return ({ update }) => {
								loading = false;
								update();
							};
						}}
						onsubmit={(e) => {
							e.preventDefault();
							return handleSubmit();
						}}
						class="space-y-4"
					>
						<!-- Error Alert -->
						{#if form?.error}
							<Alert.Root variant="destructive">
								<Alert.Description>{form.error}</Alert.Description>
							</Alert.Root>
						{/if}

						<!-- New Password Field -->
						<div class="space-y-2">
							<Label for="password">New Password</Label>
							<div class="relative">
								<Input
									id="password"
									name="password"
									type={showPassword ? 'text' : 'password'}
									placeholder="Enter your new password"
									bind:value={password}
									class="pr-10 {passwordError ? 'border-destructive' : ''}"
									required
									disabled={loading}
								/>
								<button
									type="button"
									class="absolute inset-y-0 right-0 flex items-center pr-3"
									onclick={() => (showPassword = !showPassword)}
								>
									{#if showPassword}
										<EyeOff class="text-muted-foreground h-4 w-4" />
									{:else}
										<Eye class="text-muted-foreground h-4 w-4" />
									{/if}
								</button>
							</div>
							{#if passwordError}
								<p class="text-destructive text-sm">{passwordError}</p>
							{/if}
						</div>

						<!-- Confirm Password Field -->
						<div class="space-y-2">
							<Label for="confirmPassword">Confirm New Password</Label>
							<div class="relative">
								<Input
									id="confirmPassword"
									name="confirmPassword"
									type={showConfirmPassword ? 'text' : 'password'}
									placeholder="Confirm your new password"
									bind:value={confirmPassword}
									class="pr-10 {confirmPasswordError ? 'border-destructive' : ''}"
									required
									disabled={loading}
								/>
								<button
									type="button"
									class="absolute inset-y-0 right-0 flex items-center pr-3"
									onclick={() => (showConfirmPassword = !showConfirmPassword)}
								>
									{#if showConfirmPassword}
										<EyeOff class="text-muted-foreground h-4 w-4" />
									{:else}
										<Eye class="text-muted-foreground h-4 w-4" />
									{/if}
								</button>
							</div>
							{#if confirmPasswordError}
								<p class="text-destructive text-sm">{confirmPasswordError}</p>
							{/if}
						</div>

						<!-- Password Requirements -->
						<div class="text-muted-foreground text-sm">
							<p>Password must be at least 8 characters long.</p>
						</div>

						<!-- Submit Button -->
						<Button type="submit" class="w-full" disabled={loading}>
							{#if loading}
								<div
									class="border-background mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
								></div>
								Updating password...
							{:else}
								Update password
							{/if}
						</Button>
					</form>
				</div>
			{/snippet}
		</Card.Root>

		<!-- Footer -->
		<div class="text-center">
			<p class="text-muted-foreground text-xs">
				Remember your password?
				<a href="/auth/login" class="hover:underline">Sign in here</a>
			</p>
		</div>
	</div>
</div>
