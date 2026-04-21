/*
 * Tests that verify parser options are forwarded correctly and that
 * probablyReaderableOnly short-circuits the pipeline.
 *
 * Uses vi.mock to swap @mozilla/readability with a FakeParser that captures
 * its constructor arguments and always returns null from parse().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type ConstructorCall = { doc: unknown; opts: Record<string, unknown> };

const mockState = vi.hoisted(() => ({
	captured: [] as ConstructorCall[],
	isReaderable: true,
}));

vi.mock('@mozilla/readability', () => {
	class FakeParser {
		constructor(doc: unknown, opts?: Record<string, unknown>) {
			mockState.captured.push({ doc, opts: opts ?? {} });
		}
		parse(): null {
			return null;
		}
	}
	return {
		Readability: FakeParser,
		isProbablyReaderable: () => mockState.isReaderable,
	};
});

// Imported after vi.mock so the hoisted mock applies.
import { Readability } from '../nodes/Readability/Readability.node';
import { createMockExecuteFunctions } from './mock-execute-functions';
import { articleHtml, notArticleHtml } from './test-data';

beforeEach(() => {
	mockState.captured = [];
	mockState.isReaderable = true;
});

describe('nodes/Readability/Readability.node.ts', () => {
	describe('#execute (options passthrough)', () => {
		it('should forward charThreshold, keepClasses, debug, nbTopCandidates', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'html',
					html: articleHtml,
					baseUrl: '',
					options: {
						charThreshold: 1000,
						keepClasses: true,
						debug: true,
						nbTopCandidates: 3,
					},
				},
			});
			await new Readability().execute.call(mock);
			expect(mockState.captured).toHaveLength(1);
			expect(mockState.captured[0].opts).toMatchObject({
				charThreshold: 1000,
				keepClasses: true,
				debug: true,
				nbTopCandidates: 3,
			});
		});

		it('should omit maxElemsToParse when option is 0 or unset', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'html',
					html: articleHtml,
					baseUrl: '',
					options: { maxElemsToParse: 0 },
				},
			});
			await new Readability().execute.call(mock);
			expect(mockState.captured[0].opts).not.toHaveProperty('maxElemsToParse');
		});

		it('should forward maxElemsToParse when option is > 0', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'html',
					html: articleHtml,
					baseUrl: '',
					options: { maxElemsToParse: 42 },
				},
			});
			await new Readability().execute.call(mock);
			expect(mockState.captured[0].opts).toMatchObject({ maxElemsToParse: 42 });
		});

		it('should short-circuit when probablyReaderableOnly is true and page is not readerable', async () => {
			mockState.isReaderable = false;
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'html',
					html: notArticleHtml,
					baseUrl: 'https://nav.example.com/',
					options: { probablyReaderableOnly: true },
				},
			});
			const result = (await new Readability().execute.call(mock)) as Array<
				Array<{ json: Record<string, unknown> }>
			>;
			expect(mockState.captured, 'parser constructor must not have been called').toHaveLength(0);
			expect(result[0][0].json).toMatchObject({
				readable: false,
				url: 'https://nav.example.com/',
			});
		});

		it('should still invoke the parser when probablyReaderableOnly is true and page IS readerable', async () => {
			mockState.isReaderable = true;
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'html',
					html: articleHtml,
					baseUrl: '',
					options: { probablyReaderableOnly: true },
				},
			});
			await new Readability().execute.call(mock);
			expect(mockState.captured).toHaveLength(1);
		});
	});
});
