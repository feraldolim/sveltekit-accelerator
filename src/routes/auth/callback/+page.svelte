<script lang="ts">
	import { onMount } from 'svelte';

	let message = 'Processing authentication...';

	onMount(() => {
		// Show different messages to indicate progress
		const messages = [
			'Processing authentication...',
			'Verifying credentials...',
			'Setting up your session...',
			'Almost ready...'
		];

		let index = 0;
		const interval = setInterval(() => {
			index = (index + 1) % messages.length;
			message = messages[index];
		}, 1500);

		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>Authenticating - SvelteKit Accelerator</title>
</svelte:head>

<div class="bg-background flex min-h-screen items-center justify-center">
	<div class="space-y-4 text-center">
		<div
			class="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
		></div>
		<h1 class="text-xl font-semibold">{message}</h1>
		<p class="text-muted-foreground">Please wait while we complete your sign in...</p>
	</div>
</div>
