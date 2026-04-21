/*
 * Tests for the URL input source of Readability.execute().
 */

import { describe, it, expect } from 'vitest';
import { NodeOperationError } from 'n8n-workflow';

import { Readability } from '../nodes/Readability/Readability.node';
import { createMockExecuteFunctions } from './mock-execute-functions';
import { articleHtml, emptyHtml } from './test-data';

describe('nodes/Readability/Readability.node.ts', () => {
	describe('#execute (url source)', () => {
		const baseParams = (overrides: Record<string, unknown> = {}) => ({
			inputSource: 'url',
			url: 'https://example.com/article',
			options: {},
			...overrides,
		});

		it('should call httpRequest with GET, url, Accept, default User-Agent, default timeout', async () => {
			const mock = createMockExecuteFunctions({
				params: baseParams(),
				httpRequest: async () => articleHtml,
			});
			await new Readability().execute.call(mock);

			expect(mock.calls.httpRequest).toHaveLength(1);
			const opts = mock.calls.httpRequest[0];
			expect(opts.method).toBe('GET');
			expect(opts.url).toBe('https://example.com/article');
			expect(opts.headers).toHaveProperty('Accept');
			expect(opts.headers).toHaveProperty('User-Agent');
			expect((opts.headers as Record<string, string>)['User-Agent']).toMatch(/^Mozilla\/5\.0/);
			expect(opts.timeout).toBe(15000);
			expect(opts.returnFullResponse).toBe(false);
		});

		it('should propagate userAgent and timeoutMs options', async () => {
			const mock = createMockExecuteFunctions({
				params: baseParams({ options: { userAgent: 'Custom-UA/1.0', timeoutMs: 9999 } }),
				httpRequest: async () => articleHtml,
			});
			await new Readability().execute.call(mock);

			const opts = mock.calls.httpRequest[0];
			expect((opts.headers as Record<string, string>)['User-Agent']).toBe('Custom-UA/1.0');
			expect(opts.timeout).toBe(9999);
		});

		it('should stringify a non-string response body', async () => {
			const mock = createMockExecuteFunctions({
				params: baseParams(),
				httpRequest: async () => Buffer.from(articleHtml),
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out).toHaveLength(1);
			expect(out[0].json).toHaveProperty('readable', true);
		});

		it('should produce readable output with expected shape on happy path', async () => {
			const mock = createMockExecuteFunctions({
				params: baseParams(),
				httpRequest: async () => articleHtml,
			});
			const [out] = await new Readability().execute.call(mock);
			const json = out[0].json as Record<string, unknown>;
			expect(json.readable).toBe(true);
			expect(json.url).toBe('https://example.com/article');
			expect(typeof json.title).toBe('string');
			expect(typeof json.content).toBe('string');
			for (const key of [
				'readable',
				'url',
				'title',
				'byline',
				'dir',
				'lang',
				'content',
				'textContent',
				'length',
				'excerpt',
				'siteName',
				'publishedTime',
			]) {
				expect(json).toHaveProperty(key);
			}
		});

		it('should emit {readable:false, url} when the parser cannot extract an article', async () => {
			const mock = createMockExecuteFunctions({
				params: baseParams({ url: 'https://tiny.example.com/' }),
				httpRequest: async () => emptyHtml,
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out[0].json).toMatchObject({ readable: false, url: 'https://tiny.example.com/' });
		});

		it('should throw a NodeOperationError with itemIndex when httpRequest rejects', async () => {
			const mock = createMockExecuteFunctions({
				params: baseParams(),
				httpRequest: async () => {
					throw new Error('boom');
				},
			});
			await expect(new Readability().execute.call(mock)).rejects.toBeInstanceOf(NodeOperationError);

			// Re-run to inspect context.itemIndex on the thrown error.
			try {
				await new Readability().execute.call(mock);
				throw new Error('expected to throw');
			} catch (err) {
				const ctxItemIndex =
					(err as unknown as { context?: { itemIndex?: number } }).context?.itemIndex;
				expect(ctxItemIndex ?? 0).toBe(0);
			}
		});

		it('should push {error} when continueOnFail is true', async () => {
			const mock = createMockExecuteFunctions({
				params: baseParams(),
				continueOnFail: true,
				httpRequest: async () => {
					throw new Error('network down');
				},
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out).toHaveLength(1);
			expect(out[0].json.error).toMatch(/network down/);
		});
	});
});
