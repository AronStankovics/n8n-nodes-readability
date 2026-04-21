/*
 * Tests for the URL input source of Readability.execute().
 */

import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { NodeOperationError } from 'n8n-workflow';

import { Readability } from '../nodes/Readability/Readability.node';
import { createMockExecuteFunctions } from './mock-execute-functions';
import { articleHtml, emptyHtml } from './test-data';

chai.use(chaiAsPromised);

describe('nodes/Readability/Readability.node.ts', function () {
	describe('#execute (url source)', function () {
		const baseParams = (overrides: Record<string, unknown> = {}) => ({
			inputSource: 'url',
			url: 'https://example.com/article',
			options: {},
			...overrides,
		});

		it('should call httpRequest with GET, url, Accept, default User-Agent, default timeout', async function () {
			const mock = createMockExecuteFunctions({
				params: baseParams(),
				httpRequest: async () => articleHtml,
			});
			await new Readability().execute.call(mock);

			expect(mock.calls.httpRequest).to.have.lengthOf(1);
			const opts = mock.calls.httpRequest[0];
			expect(opts.method).to.equal('GET');
			expect(opts.url).to.equal('https://example.com/article');
			expect(opts.headers).to.have.property('Accept');
			expect(opts.headers).to.have.property('User-Agent');
			expect((opts.headers as Record<string, string>)['User-Agent']).to.match(/^Mozilla\/5\.0/);
			expect(opts.timeout).to.equal(15000);
			expect(opts.returnFullResponse).to.equal(false);
		});

		it('should propagate userAgent and timeoutMs options', async function () {
			const mock = createMockExecuteFunctions({
				params: baseParams({ options: { userAgent: 'Custom-UA/1.0', timeoutMs: 9999 } }),
				httpRequest: async () => articleHtml,
			});
			await new Readability().execute.call(mock);

			const opts = mock.calls.httpRequest[0];
			expect((opts.headers as Record<string, string>)['User-Agent']).to.equal('Custom-UA/1.0');
			expect(opts.timeout).to.equal(9999);
		});

		it('should stringify a non-string response body', async function () {
			const mock = createMockExecuteFunctions({
				params: baseParams(),
				httpRequest: async () => Buffer.from(articleHtml),
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out).to.have.lengthOf(1);
			expect(out[0].json).to.have.property('readable', true);
		});

		it('should produce readable output with expected shape on happy path', async function () {
			const mock = createMockExecuteFunctions({
				params: baseParams(),
				httpRequest: async () => articleHtml,
			});
			const [out] = await new Readability().execute.call(mock);
			const json = out[0].json as Record<string, unknown>;
			expect(json.readable).to.equal(true);
			expect(json.url).to.equal('https://example.com/article');
			expect(json.title).to.be.a('string');
			expect(json.content).to.be.a('string');
			expect(json).to.include.keys([
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
			]);
		});

		it('should emit {readable:false, url} when the parser cannot extract an article', async function () {
			const mock = createMockExecuteFunctions({
				params: baseParams({ url: 'https://tiny.example.com/' }),
				httpRequest: async () => emptyHtml,
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out[0].json).to.deep.include({ readable: false, url: 'https://tiny.example.com/' });
		});

		it('should throw a NodeOperationError with itemIndex when httpRequest rejects', async function () {
			const mock = createMockExecuteFunctions({
				params: baseParams(),
				httpRequest: async () => {
					throw new Error('boom');
				},
			});
			try {
				await new Readability().execute.call(mock);
				throw new Error('expected to throw');
			} catch (err) {
				expect(err).to.be.instanceOf(NodeOperationError);
				const nodeErr = err as NodeOperationError & { context?: { itemIndex?: number } };
				const ctxItemIndex =
					(nodeErr as unknown as { context?: { itemIndex?: number } }).context?.itemIndex;
				expect(ctxItemIndex ?? 0).to.equal(0);
			}
		});

		it('should push {error} when continueOnFail is true', async function () {
			const mock = createMockExecuteFunctions({
				params: baseParams(),
				continueOnFail: true,
				httpRequest: async () => {
					throw new Error('network down');
				},
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out).to.have.lengthOf(1);
			expect(out[0].json).to.have.property('error').that.matches(/network down/);
		});
	});
});
