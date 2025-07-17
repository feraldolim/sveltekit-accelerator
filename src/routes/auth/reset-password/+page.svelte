<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { CheckCircle, ArrowLeft, Mail } from 'lucide-svelte';
	import type { ActionData } from './$types';
	import { isValidEmail } from '$lib/utils';

	export let form: ActionData;

	let loading = false;
	let email = form?.email || '';
	let emailError = '';

	function validateForm() {
		emailError = '';

		if (!email) {
			emailError = 'Email is required';
		} else if (!isValidEmail(email)) {
			emailError = 'Please enter a valid email address';
		}

		return !emailError;
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
	<title>Reset Password - SvelteKit Accelerator</title>
	<meta name="description" content="Reset your password" />
</svelte:head>

<div class="bg-background flex min-h-screen items-center justify-center px-4 py-12">
	<div class="w-full max-w-md space-y-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="text-3xl font-bold tracking-tight">Reset your password</h1>
			<p class="text-muted-foreground mt-2">
				Enter your email address and we'll send you a reset link
			</p>
		</div>

		<!-- Main Card -->
		<Card.Root class="p-6">
			{#snippet children()}
				<div class="space-y-6">
					<!-- Success Message -->
					{#if form?.success}
						<Alert.Root variant="default" class="border-green-200 bg-green-50">
							<CheckCircle class="h-4 w-4 text-green-600" />
							<Alert.Description class="text-green-800">
								{form.message}
							</Alert.Description>
						</Alert.Root>

						<div class="text-center">
							<p class="text-muted-foreground mb-4 text-sm">
								Please check your email and click the link to reset your password.
							</p>
							<Button variant="outline" href="/auth/login" class="w-full">
								<ArrowLeft class="mr-2 h-4 w-4" />
								Back to Sign In
							</Button>
						</div>
					{:else}
						<!-- Reset Form -->
						<form
							method="POST"
							action="?/reset"
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

							<!-- Email Field -->
							<div class="space-y-2">
								<Label for="email">Email address</Label>
								<div class="relative">
									<Input
										id="email"
										name="email"
										type="email"
										placeholder="Enter your email address"
										bind:value={email}
										class="pl-10 {emailError ? 'border-destructive' : ''}"
										required
										disabled={loading}
									/>
									<Mail
										class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform"
									/>
								</div>
								{#if emailError}
									<p class="text-destructive text-sm">{emailError}</p>
								{/if}
							</div>

							<!-- Submit Button -->
							<Button type="submit" class="w-full" disabled={loading}>
								{#if loading}
									<div
										class="border-background mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
									></div>
									Sending reset link...
								{:else}
									Send reset link
								{/if}
							</Button>
						</form>

						<!-- Back to Sign In -->
						<div class="text-center">
							<Button variant="ghost" href="/auth/login" class="text-sm">
								<ArrowLeft class="mr-2 h-4 w-4" />
								Back to Sign In
							</Button>
						</div>
					{/if}
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
