/*
 * Structural sanity tests for the top-level INodeTypeDescription metadata.
 * Property-specific assertions live in properties.test.ts.
 */

import { describe, it, expect } from 'vitest';

import { Readability } from '../nodes/Readability/Readability.node';

describe('nodes/Readability/Readability.node.ts', () => {
	describe('description', () => {
		const node = new Readability();
		const desc = node.description;

		it('should expose displayName, name, version, group, and usableAsTool', () => {
			expect(desc.displayName).toBe('Readability');
			expect(desc.name).toBe('readability');
			expect(desc.version).toBe(1);
			expect(desc.group).toEqual(['transform']);
			expect(desc.usableAsTool).toBe(true);
		});
	});
});
