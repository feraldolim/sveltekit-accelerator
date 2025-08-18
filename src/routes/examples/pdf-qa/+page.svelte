<script lang="ts">
	import PdfUploader from '$lib/components/PdfUploader.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge';
	import { FileText, ArrowLeft, Info } from 'lucide-svelte';

	// Props are required for authenticated pages but not used in this component

	let uploadHistory: any[] = $state([]);

	function handleUpload(event: CustomEvent) {
		console.log('PDF uploaded:', event.detail);
		uploadHistory = [...uploadHistory, {
			timestamp: new Date(),
			type: 'upload',
			data: event.detail
		}];
	}

	function handleProcess(event: CustomEvent) {
		console.log('PDF processed:', event.detail);
		uploadHistory = [...uploadHistory, {
			timestamp: new Date(),
			type: 'process',
			data: event.detail
		}];
	}
</script>

<svelte:head>
	<title>PDF Q&A Example - SvelteKit Accelerator</title>
	<meta name="description" content="Example of PDF upload and Q&A functionality" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<Button href="/dashboard" variant="ghost" size="sm" class="mb-4">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back to Dashboard
		</Button>
		
		<h1 class="mb-2 text-3xl font-bold">PDF Document Q&A</h1>
		<p class="text-muted-foreground">
			Upload PDF documents and ask questions using AI
		</p>
	</div>

	<div class="grid gap-8 lg:grid-cols-2">
		<!-- PDF Uploader Component -->
		<div>
			<PdfUploader on:upload={handleUpload} on:process={handleProcess} />
		</div>

		<!-- Information & History -->
		<div class="space-y-6">
			<!-- How it Works -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<Info class="h-5 w-5" />
						How It Works
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-3">
					<div class="space-y-2">
						<div class="flex gap-3">
							<Badge class="mt-1">1</Badge>
							<div>
								<p class="font-medium">Upload PDF</p>
								<p class="text-sm text-muted-foreground">
									Select and upload a PDF document (max 10MB)
								</p>
							</div>
						</div>
						<div class="flex gap-3">
							<Badge class="mt-1">2</Badge>
							<div>
								<p class="font-medium">Choose Action</p>
								<p class="text-sm text-muted-foreground">
									Select Q&A, Summarize, or Extract Information
								</p>
							</div>
						</div>
						<div class="flex gap-3">
							<Badge class="mt-1">3</Badge>
							<div>
								<p class="font-medium">Get Results</p>
								<p class="text-sm text-muted-foreground">
									AI processes your document and provides answers
								</p>
							</div>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Features -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Features</Card.Title>
				</Card.Header>
				<Card.Content>
					<ul class="space-y-2">
						<li class="flex items-start gap-2">
							<span class="text-success">✓</span>
							<span class="text-sm">Ask questions about document content</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-success">✓</span>
							<span class="text-sm">Generate concise summaries</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-success">✓</span>
							<span class="text-sm">Extract specific information</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-success">✓</span>
							<span class="text-sm">Multiple AI model options</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-success">✓</span>
							<span class="text-sm">Secure file storage with Supabase</span>
						</li>
					</ul>
				</Card.Content>
			</Card.Root>

			<!-- Activity History -->
			{#if uploadHistory.length > 0}
				<Card.Root>
					<Card.Header>
						<Card.Title>Activity History</Card.Title>
						<Card.Description>Your recent uploads and processes</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="space-y-3">
							{#each uploadHistory.slice(-5).reverse() as item}
								<div class="flex items-start gap-3 rounded-lg border p-3">
									<FileText class="mt-1 h-4 w-4 text-muted-foreground" />
									<div class="flex-1">
										<p class="text-sm font-medium">
											{item.type === 'upload' ? 'PDF Uploaded' : 'PDF Processed'}
										</p>
										<p class="text-xs text-muted-foreground">
											{item.timestamp.toLocaleTimeString()}
										</p>
										{#if item.type === 'process' && item.data.action}
											<Badge variant="secondary" class="mt-1 text-xs">
												{item.data.action}
											</Badge>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>
			{/if}
		</div>
	</div>

	<!-- Example Questions -->
	<div class="mt-12">
		<Card.Root>
			<Card.Header>
				<Card.Title>Example Questions</Card.Title>
				<Card.Description>
					Try these questions after uploading a document
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
					<div class="rounded-lg border bg-muted/50 p-3">
						<p class="text-sm">What is the main topic of this document?</p>
					</div>
					<div class="rounded-lg border bg-muted/50 p-3">
						<p class="text-sm">Can you summarize the key points?</p>
					</div>
					<div class="rounded-lg border bg-muted/50 p-3">
						<p class="text-sm">What conclusions does the author make?</p>
					</div>
					<div class="rounded-lg border bg-muted/50 p-3">
						<p class="text-sm">Are there any important dates mentioned?</p>
					</div>
					<div class="rounded-lg border bg-muted/50 p-3">
						<p class="text-sm">What recommendations are provided?</p>
					</div>
					<div class="rounded-lg border bg-muted/50 p-3">
						<p class="text-sm">Who is the intended audience?</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
