/*
 * Tests for the HTML input source of Readability.execute().
 */

import { describe, it, expect } from 'vitest';

import { Readability } from '../nodes/Readability/Readability.node';
import { createMockExecuteFunctions } from './mock-execute-functions';
import { articleHtml, emptyHtml } from './test-data';

describe('nodes/Readability/Readability.node.ts', () => {
	describe('#execute (html source)', () => {
		it('should parse inline HTML and return readable output', async () => {
			const mock = createMockExecuteFunctions({
				params: { inputSource: 'html', html: articleHtml, baseUrl: '', options: {} },
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out).toHaveLength(1);
			expect(out[0].json).toHaveProperty('readable', true);
			expect(typeof out[0].json.content).toBe('string');
		});

		it('should use "about:blank" as url when baseUrl is empty', async () => {
			const mock = createMockExecuteFunctions({
				params: { inputSource: 'html', html: articleHtml, baseUrl: '', options: {} },
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out[0].json).toHaveProperty('url', 'about:blank');
		});

		it('should use provided baseUrl as url when set', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'html',
					html: articleHtml,
					baseUrl: 'https://site.example.com/post',
					options: {},
				},
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out[0].json).toHaveProperty('url', 'https://site.example.com/post');
		});

		it('should return {readable:false} when the fixture cannot be parsed as an article', async () => {
			const mock = createMockExecuteFunctions({
				params: { inputSource: 'html', html: emptyHtml, baseUrl: '', options: {} },
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out[0].json).toMatchObject({ readable: false });
		});

		it('should not call helpers.httpRequest', async () => {
			const mock = createMockExecuteFunctions({
				params: { inputSource: 'html', html: articleHtml, baseUrl: '', options: {} },
			});
			await new Readability().execute.call(mock);
			expect(mock.calls.httpRequest).toHaveLength(0);
		});
	});
});
