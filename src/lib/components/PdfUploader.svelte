<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select/index.js';
	import { toast } from 'svelte-sonner';
	import { FileText, Upload, Loader2, Sparkles, X } from 'lucide-svelte';

	const dispatch = createEventDispatcher();

	let files: FileList | null = $state(null);
	let uploading = $state(false);
	let processing = $state(false);
	let uploadedPdf: any = $state(null);
	let question = $state('');
	let answer = $state('');
	let selectedAction = $state('answer');
	let selectedModel = $state('openai/gpt-3.5-turbo');
	let fileInput: HTMLInputElement | undefined = $state();

	const actions = [
		{ value: 'answer', label: 'Q&A' },
		{ value: 'summarize', label: 'Summarize' },
		{ value: 'extract', label: 'Extract Info' }
	];

	const models = [
		{ value: 'openai/gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
		{ value: 'openai/gpt-4', label: 'GPT-4' },
		{ value: 'anthropic/claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' }
	];

	const selectedFile = $derived(files?.[0] as File | undefined);
	const fileSize = $derived(selectedFile ? formatFileSize(selectedFile.size) : '');
	const canUpload = $derived(selectedFile && !uploading && !uploadedPdf);
	const canProcess = $derived(uploadedPdf && !processing && (selectedAction !== 'answer' || question.trim()));

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
	}

	async function handleUpload() {
		if (!selectedFile) return;

		uploading = true;
		const formData = new FormData();
		formData.append('file', selectedFile);
		formData.append('process', 'true');

		try {
			const response = await fetch('/api/pdf/upload', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(error || 'Upload failed');
			}

			const result = await response.json();
			uploadedPdf = result.data;
			toast.success('PDF uploaded successfully!');
			dispatch('upload', uploadedPdf);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to upload PDF');
		} finally {
			uploading = false;
		}
	}

	async function handleProcess() {
		if (!uploadedPdf) return;

		processing = true;
		answer = '';

		try {
			const body: any = {
				pdf_path: uploadedPdf.path,
				action: selectedAction,
				model: selectedModel
			};

			if (selectedAction === 'answer') {
				body.question = question;
			} else if (selectedAction === 'extract') {
				body.extract_fields = ['Title', 'Author', 'Date', 'Summary', 'Key Points'];
			}

			const response = await fetch('/api/pdf/qa', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(error || 'Processing failed');
			}

			const result = await response.json();
			answer = typeof result.data.result === 'object' 
				? JSON.stringify(result.data.result, null, 2)
				: result.data.result;
				
			toast.success('PDF processed successfully!');
			dispatch('process', { question, answer, action: selectedAction });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to process PDF');
		} finally {
			processing = false;
		}
	}

	function reset() {
		files = null;
		uploadedPdf = null;
		question = '';
		answer = '';
		if (fileInput) fileInput.value = '';
	}
</script>

<Card.Root class="w-full max-w-2xl">
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<FileText class="h-5 w-5" />
			PDF Document Q&A
		</Card.Title>
		<Card.Description>
			Upload a PDF and ask questions about its content using AI
		</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<!-- File Upload Section -->
		{#if !uploadedPdf}
			<div class="space-y-4">
				<div>
					<Label for="pdf-upload">Select PDF File</Label>
					<div class="mt-2">
						<Input
							bind:this={fileInput}
							id="pdf-upload"
							type="file"
							accept="application/pdf"
							bind:files
							disabled={uploading}
							class="cursor-pointer"
						/>
					</div>
					<p class="mt-1 text-xs text-muted-foreground">
						Maximum file size: 10MB
					</p>
				</div>

				{#if selectedFile}
					<div class="rounded-lg border bg-muted/50 p-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<FileText class="h-8 w-8 text-muted-foreground" />
								<div>
									<p class="font-medium">{selectedFile.name}</p>
									<p class="text-sm text-muted-foreground">{fileSize}</p>
								</div>
							</div>
							<Button
								size="sm"
								onclick={handleUpload}
								disabled={!canUpload}
							>
								{#if uploading}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									Uploading...
								{:else}
									<Upload class="mr-2 h-4 w-4" />
									Upload
								{/if}
							</Button>
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<!-- Uploaded PDF Info -->
			<div class="rounded-lg border bg-success/10 p-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-full bg-success/20">
							<FileText class="h-5 w-5 text-success" />
						</div>
						<div>
							<p class="font-medium">PDF Uploaded Successfully</p>
							<p class="text-sm text-muted-foreground">Ready for processing</p>
						</div>
					</div>
					<Button
						size="sm"
						variant="ghost"
						onclick={reset}
					>
						<X class="h-4 w-4" />
					</Button>
				</div>
			</div>

			<!-- Processing Options -->
			<div class="space-y-4">
				<div class="grid gap-4 md:grid-cols-2">
					<div>
						<Label>Action</Label>
						<Select.Root bind:value={selectedAction}>
							<Select.Trigger>
								<span>{actions.find(a => a.value === selectedAction)?.label || "Select action"}</span>
							</Select.Trigger>
							<Select.Content>
								{#each actions as action}
									<Select.Item value={action.value}>
										{action.label}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					<div>
						<Label>AI Model</Label>
						<Select.Root bind:value={selectedModel}>
							<Select.Trigger>
								<span>{models.find(m => m.value === selectedModel)?.label || "Select model"}</span>
							</Select.Trigger>
							<Select.Content>
								{#each models as model}
									<Select.Item value={model.value}>
										{model.label}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				{#if selectedAction === 'answer'}
					<div>
						<Label for="question">Your Question</Label>
						<Textarea
							id="question"
							bind:value={question}
							placeholder="What would you like to know about this document?"
							class="mt-2 min-h-[100px]"
							disabled={processing}
						/>
					</div>
				{/if}

				<Button
					onclick={handleProcess}
					disabled={!canProcess}
					class="w-full"
				>
					{#if processing}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Processing...
					{:else}
						<Sparkles class="mr-2 h-4 w-4" />
						{selectedAction === 'answer' ? 'Get Answer' : selectedAction === 'summarize' ? 'Generate Summary' : 'Extract Information'}
					{/if}
				</Button>
			</div>
		{/if}

		<!-- Answer Section -->
		{#if answer}
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<Label>Response</Label>
					<Badge variant="secondary">{selectedModel}</Badge>
				</div>
				<div class="rounded-lg border bg-muted/50 p-4">
					<pre class="whitespace-pre-wrap text-sm">{answer}</pre>
				</div>
			</div>
		{/if}
	</Card.Content>
</Card.Root>

