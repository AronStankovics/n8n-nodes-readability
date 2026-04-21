/*
 * Tests that verify parser options are forwarded correctly and that
 * probablyReaderableOnly short-circuits the pipeline.
 *
 * Uses proxyquire to swap @mozilla/readability with a FakeParser that
 * captures its constructor arguments and always returns null from parse().
 */

import { expect } from 'chai';

import { createMockExecuteFunctions } from './mock-execute-functions';
import { articleHtml, notArticleHtml } from './test-data';

type ConstructorCall = { doc: unknown; opts: Record<string, unknown> };

function loadWithFakeParser(
	capture: ConstructorCall[],
	isProbablyReaderable: () => boolean = () => true,
) {
	const FakeParser = function (this: unknown, doc: unknown, opts: Record<string, unknown>) {
		capture.push({ doc, opts: opts ?? {} });
	} as unknown as new (doc: unknown, opts?: Record<string, unknown>) => { parse(): null };
	(FakeParser.prototype as { parse(): null }).parse = function () {
		return null;
	};

	// Use proxyquire.load with explicit caller module so proxyquire can
	// resolve paths relative to this test file under mocha + ts-node.
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const proxyquire = require('proxyquire');
	const mod = proxyquire.load(
		'../nodes/Readability/Readability.node',
		{
			'@mozilla/readability': {
				Readability: FakeParser,
				isProbablyReaderable,
				'@noCallThru': true,
			},
		},
		module,
	) as { Readability: new () => { execute: (this: unknown) => Promise<unknown> } };
	return mod.Readability;
}

describe('nodes/Readability/Readability.node.ts', function () {
	describe('#execute (options passthrough)', function () {
		it('should forward charThreshold, keepClasses, debug, nbTopCandidates', async function () {
			const capture: ConstructorCall[] = [];
			const Readability = loadWithFakeParser(capture);
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
			expect(capture).to.have.lengthOf(1);
			expect(capture[0].opts).to.deep.include({
				charThreshold: 1000,
				keepClasses: true,
				debug: true,
				nbTopCandidates: 3,
			});
		});

		it('should omit maxElemsToParse when option is 0 or unset', async function () {
			const capture: ConstructorCall[] = [];
			const Readability = loadWithFakeParser(capture);
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'html',
					html: articleHtml,
					baseUrl: '',
					options: { maxElemsToParse: 0 },
				},
			});
			await new Readability().execute.call(mock);
			expect(capture[0].opts).to.not.have.property('maxElemsToParse');
		});

		it('should forward maxElemsToParse when option is > 0', async function () {
			const capture: ConstructorCall[] = [];
			const Readability = loadWithFakeParser(capture);
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'html',
					html: articleHtml,
					baseUrl: '',
					options: { maxElemsToParse: 42 },
				},
			});
			await new Readability().execute.call(mock);
			expect(capture[0].opts).to.deep.include({ maxElemsToParse: 42 });
		});

		it('should short-circuit when probablyReaderableOnly is true and page is not readerable', async function () {
			const capture: ConstructorCall[] = [];
			const Readability = loadWithFakeParser(capture, () => false);
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
			expect(capture, 'parser constructor must not have been called').to.have.lengthOf(0);
			expect(result[0][0].json).to.deep.include({
				readable: false,
				url: 'https://nav.example.com/',
			});
		});

		it('should still invoke the parser when probablyReaderableOnly is true and page IS readerable', async function () {
			const capture: ConstructorCall[] = [];
			const Readability = loadWithFakeParser(capture, () => true);
			const mock = createMockExecuteFunctions({
				params: {
					inputSource: 'html',
					html: articleHtml,
					baseUrl: '',
					options: { probablyReaderableOnly: true },
				},
			});
			await new Readability().execute.call(mock);
			expect(capture).to.have.lengthOf(1);
		});
	});
});
