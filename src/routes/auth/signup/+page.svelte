<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Separator } from '$lib/components/ui/separator';
	import { Eye, EyeOff, Github, Mail, CheckCircle } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';
	import { isValidEmail } from '$lib/utils';

	export let data: PageData;
	export let form: ActionData;

	let loading = false;
	let showPassword = false;
	let showConfirmPassword = false;
	let email = form?.email || '';
	let password = '';
	let confirmPassword = '';
	let fullName = form?.fullName || '';
	let emailError = '';
	let passwordError = '';
	let confirmPasswordError = '';
	let fullNameError = '';

	function validateForm() {
		emailError = '';
		passwordError = '';
		confirmPasswordError = '';
		fullNameError = '';

		if (!email) {
			emailError = 'Email is required';
		} else if (!isValidEmail(email)) {
			emailError = 'Please enter a valid email address';
		}

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

		if (!fullName) {
			fullNameError = 'Full name is required';
		}

		return !emailError && !passwordError && !confirmPasswordError && !fullNameError;
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
	<title>Sign Up - SvelteKit Accelerator</title>
	<meta name="description" content="Create your account" />
</svelte:head>

<div class="bg-background flex min-h-screen items-center justify-center px-4 py-12">
	<div class="w-full max-w-md space-y-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="text-3xl font-bold tracking-tight">Create an account</h1>
			<p class="text-muted-foreground mt-2">Get started with your free account</p>
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
					{:else}
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
								<span class="bg-background text-muted-foreground px-2">Or continue with email</span>
							</div>
						</div>

						<!-- Email/Password Form -->
						<form
							method="POST"
							action="?/signup"
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
							{#if data.redirectTo}
								<input type="hidden" name="redirectTo" value={data.redirectTo} />
							{/if}

							<!-- Error Alert -->
							{#if form?.error}
								<Alert.Root variant="destructive">
									<Alert.Description>{form.error}</Alert.Description>
								</Alert.Root>
							{/if}

							<!-- Full Name Field -->
							<div class="space-y-2">
								<Label for="fullName">Full Name</Label>
								<Input
									id="fullName"
									name="fullName"
									type="text"
									placeholder="Enter your full name"
									bind:value={fullName}
									class={fullNameError ? 'border-destructive' : ''}
									required
									disabled={loading}
								/>
								{#if fullNameError}
									<p class="text-destructive text-sm">{fullNameError}</p>
								{/if}
							</div>

							<!-- Email Field -->
							<div class="space-y-2">
								<Label for="email">Email</Label>
								<Input
									id="email"
									name="email"
									type="email"
									placeholder="Enter your email"
									bind:value={email}
									class={emailError ? 'border-destructive' : ''}
									required
									disabled={loading}
								/>
								{#if emailError}
									<p class="text-destructive text-sm">{emailError}</p>
								{/if}
							</div>

							<!-- Password Field -->
							<div class="space-y-2">
								<Label for="password">Password</Label>
								<div class="relative">
									<Input
										id="password"
										name="password"
										type={showPassword ? 'text' : 'password'}
										placeholder="Enter your password"
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
								<Label for="confirmPassword">Confirm Password</Label>
								<div class="relative">
									<Input
										id="confirmPassword"
										name="confirmPassword"
										type={showConfirmPassword ? 'text' : 'password'}
										placeholder="Confirm your password"
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

							<!-- Submit Button -->
							<Button type="submit" class="w-full" disabled={loading}>
								{#if loading}
									<div
										class="border-background mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
									></div>
									Creating account...
								{:else}
									Create account
								{/if}
							</Button>
						</form>
					{/if}

					<!-- Sign In Link -->
					<div class="text-center text-sm">
						<span class="text-muted-foreground">Already have an account?</span>
						<a
							href="/auth/login{data.redirectTo
								? `?redirectTo=${encodeURIComponent(data.redirectTo)}`
								: ''}"
							class="text-primary font-medium hover:underline"
						>
							Sign in
						</a>
					</div>
				</div>
			{/snippet}
		</Card.Root>

		<!-- Footer -->
		<div class="text-center">
			<p class="text-muted-foreground text-xs">
				By signing up, you agree to our
				<a href="/terms" class="hover:underline">Terms of Service</a>
				and
				<a href="/privacy" class="hover:underline">Privacy Policy</a>
			</p>
		</div>
	</div>
</div>
