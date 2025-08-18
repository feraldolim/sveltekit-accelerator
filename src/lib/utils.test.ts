import { describe, it, expect } from 'vitest';
import { cn } from './utils.js';

describe('Utility Functions', () => {
	describe('cn (className utility)', () => {
		it('should merge class names correctly', () => {
			const result = cn('flex items-center', 'bg-red-500', 'text-white');
			expect(result).toContain('flex');
			expect(result).toContain('items-center');
			expect(result).toContain('bg-red-500');
			expect(result).toContain('text-white');
		});

		it('should handle conditional classes', () => {
			const isActive = true;
			const isDisabled = false;
			
			const result = cn(
				'base-class',
				isActive && 'active-class',
				isDisabled && 'disabled-class'
			);
			
			expect(result).toContain('base-class');
			expect(result).toContain('active-class');
			expect(result).not.toContain('disabled-class');
		});

		it('should handle undefined and null values', () => {
			const result = cn('valid-class', undefined, null, 'another-class');
			
			expect(result).toContain('valid-class');
			expect(result).toContain('another-class');
		});

		it('should merge conflicting tailwind classes correctly', () => {
			// tailwind-merge should resolve conflicts
			const result = cn('bg-red-500', 'bg-blue-500');
			
			// Should keep the last one (blue) and remove the first (red)
			expect(result).toContain('bg-blue-500');
			expect(result).not.toContain('bg-red-500');
		});

		it('should handle empty input', () => {
			const result = cn();
			expect(result).toBe('');
		});

		it('should handle array inputs', () => {
			const result = cn(['flex', 'items-center'], 'bg-red-500');
			expect(result).toContain('flex');
			expect(result).toContain('items-center');
			expect(result).toContain('bg-red-500');
		});

		it('should handle object inputs', () => {
			const result = cn({
				'flex': true,
				'hidden': false,
				'items-center': true
			});
			
			expect(result).toContain('flex');
			expect(result).toContain('items-center');
			expect(result).not.toContain('hidden');
		});
	});
});

