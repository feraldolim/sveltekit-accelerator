import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combine class names with Tailwind CSS support
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Format date to human readable string
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
	const dateObj = typeof date === 'string' ? new Date(date) : date;

	const defaultOptions: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	};

	return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(dateObj);
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
	const dateObj = typeof date === 'string' ? new Date(date) : date;
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

	const intervals = [
		{ label: 'year', seconds: 31536000 },
		{ label: 'month', seconds: 2592000 },
		{ label: 'week', seconds: 604800 },
		{ label: 'day', seconds: 86400 },
		{ label: 'hour', seconds: 3600 },
		{ label: 'minute', seconds: 60 },
		{ label: 'second', seconds: 1 }
	];

	for (const interval of intervals) {
		const count = Math.floor(diffInSeconds / interval.seconds);
		if (count >= 1) {
			return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
		}
	}

	return 'just now';
}

/**
 * Generate a random string
 */
export function generateId(length = 8): string {
	const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout;
	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

/**
 * Throttle function execution
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;
	return (...args: Parameters<T>) => {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert string to slug format
 */
export function slugify(str: string): string {
	return str
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
	isValid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (password.length < 8) {
		errors.push('Password must be at least 8 characters long');
	}

	if (!/[A-Z]/.test(password)) {
		errors.push('Password must contain at least one uppercase letter');
	}

	if (!/[a-z]/.test(password)) {
		errors.push('Password must contain at least one lowercase letter');
	}

	if (!/\d/.test(password)) {
		errors.push('Password must contain at least one number');
	}

	if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
		errors.push('Password must contain at least one special character');
	}

	return {
		isValid: errors.length === 0,
		errors
	};
}

/**
 * Format file size to human readable format
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	if (navigator.clipboard) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch (err) {
			console.error('Failed to copy to clipboard:', err);
			return false;
		}
	} else {
		// Fallback for older browsers
		const textArea = document.createElement('textarea');
		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		try {
			const successful = document.execCommand('copy');
			document.body.removeChild(textArea);
			return successful;
		} catch (err) {
			console.error('Failed to copy to clipboard:', err);
			document.body.removeChild(textArea);
			return false;
		}
	}
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
	return name
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Truncate text to a given length
 */
export function truncate(text: string, length: number, suffix = '...'): string {
	if (text.length <= length) return text;
	return text.slice(0, length - suffix.length) + suffix;
}

/**
 * Check if code is running in browser
 */
export function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

/**
 * Local storage helpers with JSON support
 */
export const storage = {
	get<T>(key: string, defaultValue?: T): T | null {
		if (!isBrowser()) return defaultValue || null;

		try {
			const item = localStorage.getItem(key);
			return item ? JSON.parse(item) : defaultValue || null;
		} catch (error) {
			console.error('Error reading from localStorage:', error);
			return defaultValue || null;
		}
	},

	set<T>(key: string, value: T): void {
		if (!isBrowser()) return;

		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch (error) {
			console.error('Error writing to localStorage:', error);
		}
	},

	remove(key: string): void {
		if (!isBrowser()) return;

		try {
			localStorage.removeItem(key);
		} catch (error) {
			console.error('Error removing from localStorage:', error);
		}
	},

	clear(): void {
		if (!isBrowser()) return;

		try {
			localStorage.clear();
		} catch (error) {
			console.error('Error clearing localStorage:', error);
		}
	}
};

/**
 * URL helpers
 */
export const url = {
	/**
	 * Build URL with query parameters
	 */
	build(base: string, params: Record<string, string | number | boolean | undefined>): string {
		const url = new URL(base, window.location.origin);

		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined) {
				url.searchParams.set(key, String(value));
			}
		});

		return url.toString();
	},

	/**
	 * Get query parameter value
	 */
	getParam(name: string): string | null {
		if (!isBrowser()) return null;

		const urlParams = new URLSearchParams(window.location.search);
		return urlParams.get(name);
	},

	/**
	 * Get all query parameters
	 */
	getParams(): Record<string, string> {
		if (!isBrowser()) return {};

		const params: Record<string, string> = {};
		const urlParams = new URLSearchParams(window.location.search);

		urlParams.forEach((value, key) => {
			params[key] = value;
		});

		return params;
	}
};

/**
 * Array helpers
 */
export const array = {
	/**
	 * Remove duplicates from array
	 */
	unique<T>(arr: T[]): T[] {
		return [...new Set(arr)];
	},

	/**
	 * Group array items by a key
	 */
	groupBy<T, K extends keyof T>(arr: T[], key: K): Record<string, T[]> {
		return arr.reduce(
			(groups, item) => {
				const groupKey = String(item[key]);
				groups[groupKey] = groups[groupKey] || [];
				groups[groupKey].push(item);
				return groups;
			},
			{} as Record<string, T[]>
		);
	},

	/**
	 * Shuffle array randomly
	 */
	shuffle<T>(arr: T[]): T[] {
		const shuffled = [...arr];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	},

	/**
	 * Get random item from array
	 */
	random<T>(arr: T[]): T | undefined {
		return arr[Math.floor(Math.random() * arr.length)];
	}
};
