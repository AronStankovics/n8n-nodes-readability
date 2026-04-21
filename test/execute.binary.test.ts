/*
 * Tests for the binary input source of Readability.execute().
 */

import { describe, it, expect } from 'vitest';

import { Readability } from '../nodes/Readability/Readability.node';
import { createMockExecuteFunctions } from './mock-execute-functions';
import { articleHtml } from './test-data';

describe('nodes/Readability/Readability.node.ts', () => {
	describe('#execute (binary source)', () => {
		it('should call getBinaryDataBuffer with the default "data" property', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'binary',
					baseUrl: '',
					inputBinaryProperty: 'data',
					options: {},
				},
				getBinaryDataBuffer: async () => Buffer.from(articleHtml, 'utf-8'),
			});
			await new Readability().execute.call(mock);
			expect(mock.calls.getBinaryDataBuffer).toEqual([
				{ itemIndex: 0, propertyName: 'data' },
			]);
		});

		it('should call getBinaryDataBuffer with a custom property name', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'binary',
					baseUrl: '',
					inputBinaryProperty: 'attachment',
					options: {},
				},
				getBinaryDataBuffer: async () => Buffer.from(articleHtml, 'utf-8'),
			});
			await new Readability().execute.call(mock);
			expect(mock.calls.getBinaryDataBuffer[0].propertyName).toBe('attachment');
		});

		it('should decode the buffer as utf-8 and produce readable output', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'binary',
					baseUrl: '',
					inputBinaryProperty: 'data',
					options: {},
				},
				getBinaryDataBuffer: async () => Buffer.from(articleHtml, 'utf-8'),
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out[0].json).toHaveProperty('readable', true);
			expect(typeof out[0].json.content).toBe('string');
		});

		it('should honour baseUrl for binary items', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'binary',
					baseUrl: 'https://bin.example.com/report',
					inputBinaryProperty: 'data',
					options: {},
				},
				getBinaryDataBuffer: async () => Buffer.from(articleHtml, 'utf-8'),
			});
			const [out] = await new Readability().execute.call(mock);
			expect(out[0].json).toHaveProperty('url', 'https://bin.example.com/report');
		});
	});
});
