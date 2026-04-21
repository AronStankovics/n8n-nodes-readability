/*
 * Tests for Readability.execute() error paths and continueOnFail semantics.
 */

import { describe, it, expect } from 'vitest';
import { NodeOperationError } from 'n8n-workflow';

import { Readability } from '../nodes/Readability/Readability.node';
import { createMockExecuteFunctions } from './mock-execute-functions';
import { articleHtml } from './test-data';

describe('nodes/Readability/Readability.node.ts', () => {
	describe('#execute (error handling)', () => {
		it('should rethrow an existing NodeOperationError unchanged', async () => {
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
			await expect(new Readability().execute.call(mock)).rejects.toBe(existing);
		});

		it('should wrap a plain Error as a NodeOperationError with itemIndex', async () => {
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
				expect(err).toBeInstanceOf(NodeOperationError);
				const ctx = (err as unknown as { context?: { itemIndex?: number } }).context;
				expect(ctx?.itemIndex ?? 0).toBe(0);
			}
		});

		it('should include the error message in json.error when continueOnFail is true', async () => {
			const mock = createMockExecuteFunctions({
				params: { inputSource: 'url', url: 'https://ex.com/a', options: {} },
				continueOnFail: true,
				httpRequest: async () => {
					throw new Error('helpful message');
				},
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out[0].json.error).toMatch(/helpful message/);
		});

		it('should continue processing remaining items when one item fails with continueOnFail', async () => {
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
			expect(out).toHaveLength(3);
			expect(out[0].json).toHaveProperty('readable', true);
			expect(out[1].json.error).toMatch(/middle failed/);
			expect(out[2].json).toHaveProperty('readable', true);
		});
	});
});
