/*
 * Structural sanity tests for the INodeProperties array.
 * Guards against accidental renames / removals of properties and options.
 */

import { describe, it, expect } from 'vitest';

import { properties } from '../nodes/Readability/properties';

function findProperty(name: string) {
	return properties.find((p) => p.name === name);
}

describe('nodes/Readability/properties.ts', () => {
	describe('properties', () => {
		it('should expose exactly the expected top-level properties', () => {
			const names = properties.map((p) => p.name);
			expect(names.sort()).toEqual(
				['inputSource', 'url', 'html', 'baseUrl', 'inputBinaryProperty', 'options'].sort(),
			);
		});

		it('should offer url/html/binary as inputSource values', () => {
			const inputSource = findProperty('inputSource');
			expect(inputSource, 'inputSource missing').toBeDefined();
			const values = (inputSource!.options ?? []).map((o) => {
				const anyO = o as { value?: string };
				return anyO.value;
			});
			expect(values.sort()).toEqual(['binary', 'html', 'url']);
		});

		it('should expose every documented option key on the options collection', () => {
			const options = findProperty('options');
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
			const options = findProperty('options')!.options ?? [];
			const removeLinks = options.find((o) => {
				const anyO = o as { name?: string };
				return anyO.name === 'removeLinks';
			}) as { options?: Array<{ value?: string }> } | undefined;
			const values = (removeLinks?.options ?? []).map((o) => o.value);
			expect(values!.sort()).toEqual(['keep', 'strip', 'unwrap']);
		});

		it('should offer keep/remove/qr for videos', () => {
			const options = findProperty('options')!.options ?? [];
			const videos = options.find((o) => {
				const anyO = o as { name?: string };
				return anyO.name === 'videos';
			}) as { options?: Array<{ value?: string }> } | undefined;
			const values = (videos?.options ?? []).map((o) => o.value);
			expect(values!.sort()).toEqual(['keep', 'qr', 'remove']);
		});
	});
});
