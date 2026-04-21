/*
 * Tests for Readability.execute() error paths and continueOnFail semantics.
 */

import { expect } from 'chai';
import { NodeOperationError } from 'n8n-workflow';

import { Readability } from '../nodes/Readability/Readability.node';
import { createMockExecuteFunctions } from './mock-execute-functions';
import { articleHtml } from './test-data';

describe('nodes/Readability/Readability.node.ts', function () {
	describe('#execute (error handling)', function () {
		it('should rethrow an existing NodeOperationError unchanged', async function () {
			const existing = new NodeOperationError(
				{ id: 'x', name: 'n', type: 't', typeVersion: 1, position: [0, 0], parameters: {} },
				'boom from httpRequest',
			);
			const mock = createMockExecuteFunctions({
				params: { inputSource: 'url', url: 'https://ex.com/a', options: {} },
				httpRequest: async () => {
					throw existing;
				},
			});
			try {
				await new Readability().execute.call(mock);
				throw new Error('expected execute to throw');
			} catch (err) {
				expect(err).to.equal(existing);
			}
		});

		it('should wrap a plain Error as a NodeOperationError with itemIndex', async function () {
			const mock = createMockExecuteFunctions({
				params: { inputSource: 'url', url: 'https://ex.com/a', options: {} },
				httpRequest: async () => {
					throw new Error('kaboom');
				},
			});
			try {
				await new Readability().execute.call(mock);
				throw new Error('expected execute to throw');
			} catch (err) {
				expect(err).to.be.instanceOf(NodeOperationError);
				const ctx = (err as unknown as { context?: { itemIndex?: number } }).context;
				expect(ctx?.itemIndex ?? 0).to.equal(0);
			}
		});

		it('should include the error message in json.error when continueOnFail is true', async function () {
			const mock = createMockExecuteFunctions({
				params: { inputSource: 'url', url: 'https://ex.com/a', options: {} },
				continueOnFail: true,
				httpRequest: async () => {
					throw new Error('helpful message');
				},
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out[0].json).to.have.property('error').that.match(/helpful message/);
		});

		it('should continue processing remaining items when one item fails with continueOnFail', async function () {
			let call = 0;
			const mock = createMockExecuteFunctions({
				items: [{ json: {} }, { json: {} }, { json: {} }],
				params: (name, itemIndex) => {
					if (name === 'inputSource') return 'url';
					if (name === 'url') return `https://ex.com/${itemIndex}`;
					if (name === 'options') return {};
					return undefined;
				},
				continueOnFail: true,
				httpRequest: async () => {
					const thisCall = call++;
					if (thisCall === 1) throw new Error('middle failed');
					return articleHtml;
				},
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out).to.have.lengthOf(3);
			expect(out[0].json).to.have.property('readable', true);
			expect(out[1].json).to.have.property('error').that.match(/middle failed/);
			expect(out[2].json).to.have.property('readable', true);
		});
	});
});
