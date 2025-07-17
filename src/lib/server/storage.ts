import { supabase, supabaseAdmin } from './supabase.js';
import { v4 as uuidv4 } from 'uuid';

interface UploadOptions {
	bucket: string;
	path?: string;
	contentType?: string;
	cacheControl?: string;
	upsert?: boolean;
}

interface UploadResult {
	data: {
		id: string;
		path: string;
		fullPath: string;
		publicUrl: string;
	} | null;
	error: Error | null;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
	file: File,
	options: UploadOptions
): Promise<UploadResult> {
	try {
		const fileExtension = file.name.split('.').pop();
		const fileName = `${uuidv4()}.${fileExtension}`;
		const filePath = options.path ? `${options.path}/${fileName}` : fileName;

		const { data, error } = await supabaseAdmin.storage
			.from(options.bucket)
			.upload(filePath, file, {
				contentType: options.contentType || file.type,
				cacheControl: options.cacheControl || '3600',
				upsert: options.upsert || false
			});

		if (error) {
			return { data: null, error };
		}

		// Get public URL
		const { data: publicUrlData } = supabaseAdmin.storage
			.from(options.bucket)
			.getPublicUrl(filePath);

		return {
			data: {
				id: data.id,
				path: filePath,
				fullPath: data.fullPath,
				publicUrl: publicUrlData.publicUrl
			},
			error: null
		};
	} catch (error) {
		return { data: null, error: error as Error };
	}
}

/**
 * Upload file from buffer
 */
export async function uploadFileFromBuffer(
	buffer: ArrayBuffer,
	fileName: string,
	options: UploadOptions
): Promise<UploadResult> {
	try {
		const fileExtension = fileName.split('.').pop();
		const uniqueFileName = `${uuidv4()}.${fileExtension}`;
		const filePath = options.path ? `${options.path}/${uniqueFileName}` : uniqueFileName;

		const { data, error } = await supabaseAdmin.storage
			.from(options.bucket)
			.upload(filePath, buffer, {
				contentType: options.contentType || 'application/octet-stream',
				cacheControl: options.cacheControl || '3600',
				upsert: options.upsert || false
			});

		if (error) {
			return { data: null, error };
		}

		// Get public URL
		const { data: publicUrlData } = supabaseAdmin.storage
			.from(options.bucket)
			.getPublicUrl(filePath);

		return {
			data: {
				id: data.id,
				path: filePath,
				fullPath: data.fullPath,
				publicUrl: publicUrlData.publicUrl
			},
			error: null
		};
	} catch (error) {
		return { data: null, error: error as Error };
	}
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(bucket: string, path: string) {
	const { data, error } = await supabaseAdmin.storage
		.from(bucket)
		.remove([path]);

	return { data, error };
}

/**
 * Delete multiple files from Supabase Storage
 */
export async function deleteFiles(bucket: string, paths: string[]) {
	const { data, error } = await supabaseAdmin.storage
		.from(bucket)
		.remove(paths);

	return { data, error };
}

/**
 * List files in a bucket
 */
export async function listFiles(bucket: string, path?: string, limit?: number, offset?: number) {
	const { data, error } = await supabaseAdmin.storage
		.from(bucket)
		.list(path, {
			limit,
			offset,
			sortBy: { column: 'created_at', order: 'desc' }
		});

	return { data, error };
}

/**
 * Get file info
 */
export async function getFileInfo(bucket: string, path: string) {
	const { data, error } = await supabaseAdmin.storage
		.from(bucket)
		.getPublicUrl(path);

	if (error) {
		return { data: null, error };
	}

	return { data, error: null };
}

/**
 * Download file as buffer
 */
export async function downloadFile(bucket: string, path: string) {
	const { data, error } = await supabaseAdmin.storage
		.from(bucket)
		.download(path);

	return { data, error };
}

/**
 * Get signed URL for private files
 */
export async function getSignedUrl(bucket: string, path: string, expiresIn: number = 3600) {
	const { data, error } = await supabaseAdmin.storage
		.from(bucket)
		.createSignedUrl(path, expiresIn);

	return { data, error };
}

/**
 * Copy file within storage
 */
export async function copyFile(bucket: string, fromPath: string, toPath: string) {
	const { data, error } = await supabaseAdmin.storage
		.from(bucket)
		.copy(fromPath, toPath);

	return { data, error };
}

/**
 * Move file within storage
 */
export async function moveFile(bucket: string, fromPath: string, toPath: string) {
	const { data, error } = await supabaseAdmin.storage
		.from(bucket)
		.move(fromPath, toPath);

	return { data, error };
}

/**
 * Create storage bucket
 */
export async function createBucket(name: string, options?: {
	public?: boolean;
	allowedMimeTypes?: string[];
	fileSizeLimit?: number;
}) {
	const { data, error } = await supabaseAdmin.storage
		.createBucket(name, {
			public: options?.public || false,
			allowedMimeTypes: options?.allowedMimeTypes,
			fileSizeLimit: options?.fileSizeLimit
		});

	return { data, error };
}

/**
 * Delete storage bucket
 */
export async function deleteBucket(name: string) {
	const { data, error } = await supabaseAdmin.storage
		.deleteBucket(name);

	return { data, error };
}

/**
 * Get bucket info
 */
export async function getBucket(name: string) {
	const { data, error } = await supabaseAdmin.storage
		.getBucket(name);

	return { data, error };
}

/**
 * List all buckets
 */
export async function listBuckets() {
	const { data, error } = await supabaseAdmin.storage
		.listBuckets();

	return { data, error };
}

/**
 * Validate file type
 */
export function isValidFileType(file: File, allowedTypes: string[]): boolean {
	return allowedTypes.includes(file.type);
}

/**
 * Validate file size
 */
export function isValidFileSize(file: File, maxSize: number): boolean {
	return file.size <= maxSize;
}

/**
 * Generate optimized image sizes
 */
export async function generateImageSizes(
	originalFile: File,
	sizes: { width: number; height?: number; suffix: string }[]
): Promise<{ size: string; file: File }[]> {
	// This is a placeholder for image processing
	// In a real implementation, you would use a library like sharp or canvas
	// to resize images on the server side
	
	const results: { size: string; file: File }[] = [];
	
	// For now, just return the original file for each size
	// You can implement actual image resizing using sharp, canvas, or similar
	for (const size of sizes) {
		results.push({
			size: size.suffix,
			file: originalFile
		});
	}
	
	return results;
}

/**
 * Clean up old files based on age
 */
export async function cleanupOldFiles(
	bucket: string,
	path: string,
	maxAge: number // in milliseconds
) {
	const { data: files, error } = await listFiles(bucket, path);
	
	if (error || !files) {
		return { data: null, error };
	}
	
	const now = Date.now();
	const filesToDelete = files
		.filter(file => {
			const fileAge = now - new Date(file.created_at).getTime();
			return fileAge > maxAge;
		})
		.map(file => file.name);
	
	if (filesToDelete.length === 0) {
		return { data: { deletedCount: 0 }, error: null };
	}
	
	const { data, error: deleteError } = await deleteFiles(bucket, filesToDelete);
	
	return { 
		data: { deletedCount: filesToDelete.length }, 
		error: deleteError 
	};
}

// Common storage configurations
export const STORAGE_BUCKETS = {
	AVATARS: 'avatars',
	DOCUMENTS: 'documents',
	IMAGES: 'images',
	UPLOADS: 'uploads'
} as const;

export const ALLOWED_IMAGE_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp'
];

export const ALLOWED_DOCUMENT_TYPES = [
	'application/pdf',
	'text/plain',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB