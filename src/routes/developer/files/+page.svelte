<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Progress } from '$lib/components/ui/progress';
	import { 
		FileText, 
		Upload, 
		CheckCircle, 
		XCircle, 
		Clock,
		HardDrive,
		Zap,
		TrendingUp,
		Download,
		Eye,
		BarChart3
	} from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function formatDuration(seconds: number): string {
		if (seconds < 60) return `${seconds.toFixed(1)}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
			case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
			case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
			case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
			default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
		}
	}

	function getStatusIcon(status: string) {
		switch (status) {
			case 'completed': return CheckCircle;
			case 'processing': return Clock;
			case 'failed': return XCircle;
			case 'pending': return Upload;
			default: return FileText;
		}
	}

	const successRate = $derived(data.fileStats.total_files > 0 
		? (data.fileStats.processed_files / data.fileStats.total_files) * 100 
		: 0);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">File Processing Analytics</h1>
			<p class="text-muted-foreground mt-1">
				Track and monitor file processing metrics from chat conversations
			</p>
		</div>
		<Badge variant="outline" class="flex items-center space-x-2">
			<Clock class="h-4 w-4" />
			<span>Coming Soon</span>
		</Badge>
	</div>

	<!-- Coming Soon Content -->
	<Card.Root class="border-dashed">
		<Card.Content class="p-12 text-center">
			<BarChart3 class="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
			<h3 class="text-2xl font-bold mb-4">File Processing Analytics</h3>
			<p class="text-muted-foreground mb-6 max-w-2xl mx-auto">
				This analytics dashboard will track file processing metrics from your chat conversations. 
				Monitor upload volumes, processing success rates, file types, and performance insights 
				across all your OpenRouter-powered file interactions.
			</p>
			
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
				<div class="p-4 rounded-lg border">
					<BarChart3 class="h-8 w-8 mx-auto mb-3 text-blue-500" />
					<h4 class="font-semibold mb-2">Processing Metrics</h4>
					<p class="text-sm text-muted-foreground">
						Track success rates, processing times, and throughput analytics
					</p>
				</div>
				<div class="p-4 rounded-lg border">
					<FileText class="h-8 w-8 mx-auto mb-3 text-green-500" />
					<h4 class="font-semibold mb-2">File Type Analytics</h4>
					<p class="text-sm text-muted-foreground">
						Analyze distribution of PDFs, audio files, and document types processed
					</p>
				</div>
				<div class="p-4 rounded-lg border">
					<TrendingUp class="h-8 w-8 mx-auto mb-3 text-purple-500" />
					<h4 class="font-semibold mb-2">Usage Trends</h4>
					<p class="text-sm text-muted-foreground">
						Monitor upload patterns, peak usage times, and processing volume trends
					</p>
				</div>
			</div>

			<div class="mt-8">
				<Badge variant="outline" class="text-sm px-4 py-2">
					<Clock class="h-4 w-4 mr-2" />
					Analytics will populate from chat file uploads
				</Badge>
			</div>
		</Card.Content>
	</Card.Root>
</div>