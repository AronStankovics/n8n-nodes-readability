/*
 * Unit tests for nodes/Readability/source/load.ts — the input-source
 * dispatch that loads HTML from URL / string / binary.
 */

import { describe, it, expect } from 'vitest';

import {
	loadDocument,
	type LoaderContext,
	type LoaderDefaults,
} from '../../nodes/Readability/source/load';
import { createMockExecuteFunctions } from '../mock-execute-functions';

const DEFAULTS: LoaderDefaults = {
	userAgent: 'test-ua/1.0',
	timeoutMs: 5000,
	binaryProperty: 'data',
};

function ctxFor(
	mock: ReturnType<typeof createMockExecuteFunctions>,
	itemIndex = 0,
	requestOptions: { userAgent?: string; timeoutMs?: number } = {},
): LoaderContext {
	return { ctx: mock, itemIndex, requestOptions, defaults: DEFAULTS };
}

describe('nodes/Readability/source/load.ts', () => {
	describe("#loadDocument(source='url')", () => {
		it('should call httpRequest with the configured URL, default UA and timeout', async () => {
			const mock = createMockExecuteFunctions({
				params: { url: 'https://example.com/a' },
				httpRequest: async () => '<html></html>',
			});
			const result = await loadDocument('url', ctxFor(mock));
			expect(result).toEqual({ html: '<html></html>', url: 'https://example.com/a' });
			expect(mock.calls.httpRequest).toHaveLength(1);
			const opts = mock.calls.httpRequest[0];
			expect(opts.method).toBe('GET');
			expect(opts.url).toBe('https://example.com/a');
			expect((opts.headers as Record<string, string>)['User-Agent']).toBe('test-ua/1.0');
			expect(opts.timeout).toBe(5000);
			expect(opts.returnFullResponse).toBe(false);
		});

		it('should prefer requestOptions over defaults', async () => {
			const mock = createMockExecuteFunctions({
				params: { url: 'https://example.com/a' },
				httpRequest: async () => '<html></html>',
			});
			await loadDocument('url', ctxFor(mock, 0, { userAgent: 'Custom/1.0', timeoutMs: 9999 }));
			const opts = mock.calls.httpRequest[0];
			expect((opts.headers as Record<string, string>)['User-Agent']).toBe('Custom/1.0');
			expect(opts.timeout).toBe(9999);
		});

		it('should stringify a non-string response body', async () => {
			const mock = createMockExecuteFunctions({
				params: { url: 'https://example.com/a' },
				httpRequest: async () => Buffer.from('<html>buf</html>', 'utf-8'),
			});
			const result = await loadDocument('url', ctxFor(mock));
			expect(result.html).toBe('<html>buf</html>');
		});

		it('should propagate httpRequest errors', async () => {
			const mock = createMockExecuteFunctions({
				params: { url: 'https://example.com/a' },
				httpRequest: async () => {
					throw new Error('net down');
				},
			});
			await expect(loadDocument('url', ctxFor(mock))).rejects.toThrow('net down');
		});

		it('should send an Accept header negotiating HTML', async () => {
			const mock = createMockExecuteFunctions({
				params: { url: 'https://example.com/a' },
				httpRequest: async () => '',
			});
			await loadDocument('url', ctxFor(mock));
			const headers = mock.calls.httpRequest[0].headers as Record<string, string>;
			expect(headers.Accept).toMatch(/text\/html/);
		});
	});

	describe("#loadDocument(source='html')", () => {
		it('should read the html parameter and return url=null when baseUrl is empty', async () => {
			const mock = createMockExecuteFunctions({
				params: { html: '<html>x</html>', baseUrl: '' },
			});
			const result = await loadDocument('html', ctxFor(mock));
			expect(result).toEqual({ html: '<html>x</html>', url: null });
		});

		it('should use baseUrl as the url when provided', async () => {
			const mock = createMockExecuteFunctions({
				params: { html: '<html>x</html>', baseUrl: 'https://site.example.com/post' },
			});
			const result = await loadDocument('html', ctxFor(mock));
			expect(result).toEqual({
				html: '<html>x</html>',
				url: 'https://site.example.com/post',
			});
		});

		it('should not call httpRequest or getBinaryDataBuffer', async () => {
			const mock = createMockExecuteFunctions({
				params: { html: '<html>x</html>', baseUrl: '' },
			});
			await loadDocument('html', ctxFor(mock));
			expect(mock.calls.httpRequest).toHaveLength(0);
			expect(mock.calls.getBinaryDataBuffer).toHaveLength(0);
		});
	});

	describe("#loadDocument(source='binary')", () => {
		it('should read the named binary property and decode as utf-8', async () => {
			const mock = createMockExecuteFunctions({
				params: { inputBinaryProperty: 'attachment', baseUrl: '' },
				getBinaryDataBuffer: async () => Buffer.from('<html>binary</html>', 'utf-8'),
			});
			const result = await loadDocument('binary', ctxFor(mock));
			expect(result).toEqual({ html: '<html>binary</html>', url: null });
			expect(mock.calls.getBinaryDataBuffer).toEqual([
				{ itemIndex: 0, propertyName: 'attachment' },
			]);
		});

		it('should fall back to defaults.binaryProperty when the param is missing', async () => {
			const mock = createMockExecuteFunctions({
				// no inputBinaryProperty in params
				params: { baseUrl: '' },
				getBinaryDataBuffer: async () => Buffer.from('<html>default</html>', 'utf-8'),
			});
			await loadDocument('binary', ctxFor(mock));
			expect(mock.calls.getBinaryDataBuffer[0].propertyName).toBe('data');
		});

		it('should return baseUrl as url when provided', async () => {
			const mock = createMockExecuteFunctions({
				params: {
					inputBinaryProperty: 'data',
					baseUrl: 'https://bin.example.com/report',
				},
				getBinaryDataBuffer: async () => Buffer.from('<html></html>', 'utf-8'),
			});
			const result = await loadDocument('binary', ctxFor(mock));
			expect(result.url).toBe('https://bin.example.com/report');
		});
	});
});
