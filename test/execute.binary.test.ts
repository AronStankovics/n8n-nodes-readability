/*
 * Tests for the binary input source of Readability.execute().
 */

import { expect } from 'chai';

import { Readability } from '../nodes/Readability/Readability.node';
import { createMockExecuteFunctions } from './mock-execute-functions';
import { articleHtml } from './test-data';

describe('nodes/Readability/Readability.node.ts', function () {
	describe('#execute (binary source)', function () {
		it('should call getBinaryDataBuffer with the default "data" property', async function () {
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
			expect(mock.calls.getBinaryDataBuffer).to.deep.equal([
				{ itemIndex: 0, propertyName: 'data' },
			]);
		});

		it('should call getBinaryDataBuffer with a custom property name', async function () {
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
			expect(mock.calls.getBinaryDataBuffer[0].propertyName).to.equal('attachment');
		});

		it('should decode the buffer as utf-8 and produce readable output', async function () {
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
			expect(out[0].json).to.have.property('readable', true);
			expect(out[0].json).to.have.property('content').that.is.a('string');
		});

		it('should honour baseUrl for binary items', async function () {
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
			expect(out[0].json).to.have.property('url', 'https://bin.example.com/report');
		});
	});
});
