/*
 * Structural sanity tests for the INodeTypeDescription block.
 * Guards against accidental renames / removals of properties and options.
 */

import { describe, it, expect } from 'vitest';

import { Readability } from '../nodes/Readability/Readability.node';

function findProperty(node: Readability, name: string) {
	return node.description.properties.find((p) => p.name === name);
}

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

		it('should expose exactly the expected top-level properties', () => {
			const names = desc.properties.map((p) => p.name);
			expect(names.sort()).toEqual(
				['inputSource', 'url', 'html', 'baseUrl', 'inputBinaryProperty', 'options'].sort(),
			);
		});

		it('should offer url/html/binary as inputSource values', () => {
			const inputSource = findProperty(node, 'inputSource');
			expect(inputSource, 'inputSource missing').toBeDefined();
			const values = (inputSource!.options ?? []).map((o) => {
				const anyO = o as { value?: string };
				return anyO.value;
			});
			expect(values.sort()).toEqual(['binary', 'html', 'url']);
		});

		it('should expose every documented option key on the options collection', () => {
			const options = findProperty(node, 'options');
			expect(options, 'options missing').toBeDefined();
			const keys = (options!.options ?? []).map((o) => {
				const anyO = o as { name?: string };
				return anyO.name;
			});
			expect(keys.sort()).toEqual(
				[
					'charThreshold',
					'debug',
					'keepClasses',
					'maxElemsToParse',
					'nbTopCandidates',
					'probablyReaderableOnly',
					'removeLinks',
					'timeoutMs',
					'unwrapImageTables',
					'userAgent',
					'videos',
				].sort(),
			);
		});

		it('should offer keep/unwrap/strip for removeLinks', () => {
			const options = findProperty(node, 'options')!.options ?? [];
			const removeLinks = options.find((o) => {
				const anyO = o as { name?: string };
				return anyO.name === 'removeLinks';
			}) as { options?: Array<{ value?: string }> } | undefined;
			const values = (removeLinks?.options ?? []).map((o) => o.value);
			expect(values!.sort()).toEqual(['keep', 'strip', 'unwrap']);
		});

		it('should offer keep/remove/qr for videos', () => {
			const options = findProperty(node, 'options')!.options ?? [];
			const videos = options.find((o) => {
				const anyO = o as { name?: string };
				return anyO.name === 'videos';
			}) as { options?: Array<{ value?: string }> } | undefined;
			const values = (videos?.options ?? []).map((o) => o.value);
			expect(values!.sort()).toEqual(['keep', 'qr', 'remove']);
		});
	});
});
