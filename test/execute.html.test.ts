/*
 * Tests for the HTML input source of Readability.execute().
 */

import { expect } from 'chai';

import { Readability } from '../nodes/Readability/Readability.node';
import { createMockExecuteFunctions } from './mock-execute-functions';
import { articleHtml, emptyHtml } from './test-data';

describe('nodes/Readability/Readability.node.ts', function () {
	describe('#execute (html source)', function () {
		it('should parse inline HTML and return readable output', async function () {
			const mock = createMockExecuteFunctions({
				params: { inputSource: 'html', html: articleHtml, baseUrl: '', options: {} },
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out).to.have.lengthOf(1);
			expect(out[0].json).to.have.property('readable', true);
			expect(out[0].json).to.have.property('content').that.is.a('string');
		});

		it('should use "about:blank" as url when baseUrl is empty', async function () {
			const mock = createMockExecuteFunctions({
				params: { inputSource: 'html', html: articleHtml, baseUrl: '', options: {} },
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out[0].json).to.have.property('url', 'about:blank');
		});

		it('should use provided baseUrl as url when set', async function () {
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'html',
					html: articleHtml,
					baseUrl: 'https://site.example.com/post',
					options: {},
				},
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out[0].json).to.have.property('url', 'https://site.example.com/post');
		});

		it('should return {readable:false} when the fixture cannot be parsed as an article', async function () {
			const mock = createMockExecuteFunctions({
				params: { inputSource: 'html', html: emptyHtml, baseUrl: '', options: {} },
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out[0].json).to.deep.include({ readable: false });
		});

		it('should not call helpers.httpRequest', async function () {
			const mock = createMockExecuteFunctions({
				params: { inputSource: 'html', html: articleHtml, baseUrl: '', options: {} },
			});
			await new Readability().execute.call(mock);
			expect(mock.calls.httpRequest).to.have.lengthOf(0);
		});
	});
});
