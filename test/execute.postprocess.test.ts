/*
 * Tests for the HTML post-processing branches: unwrapImageTables, videos
 * (keep/remove/qr), and removeLinks (keep/unwrap/strip), including their
 * interactions and the textContent/length refresh semantics.
 *
 * Uses proxyquire to swap the `qrcode` module with a stub returning a
 * deterministic SVG so tests are fast and hermetic.
 */

import { expect } from 'chai';
import proxyquire from 'proxyquire';

import { createMockExecuteFunctions } from './mock-execute-functions';
import { fakeQrSvg, imageTableHtml, linksHtml, videoHtml } from './test-data';

const noCallThru = proxyquire.noCallThru();

function loadWithStubbedQr() {
	const qrCallLog: string[] = [];
	const stub = {
		toString: async (url: string) => {
			qrCallLog.push(url);
			return fakeQrSvg;
		},
		default: {
			toString: async (url: string) => {
				qrCallLog.push(url);
				return fakeQrSvg;
			},
		},
		'@noCallThru': true,
	};
	const mod = noCallThru('../nodes/Readability/Readability.node', {
		qrcode: stub,
	}) as { Readability: new () => { execute: (this: unknown) => Promise<unknown> } };
	return { Readability: mod.Readability, qrCallLog };
}

async function runHtml(
	Readability: new () => { execute: (this: unknown) => Promise<unknown> },
	html: string,
	options: Record<string, unknown>,
	baseUrl = '',
) {
	const mock = createMockExecuteFunctions({
		params: { inputSource: 'html', html, baseUrl, options },
	});
	const result = (await new Readability().execute.call(mock)) as Array<
		Array<{ json: Record<string, unknown> }>
	>;
	return result[0][0].json;
}

describe('nodes/Readability/Readability.node.ts', function () {
	describe('#execute (post-processing)', function () {
		describe('unwrapImageTables', function () {
			it('should replace a single-img <table> with a clone of the <img>', async function () {
				const { Readability } = loadWithStubbedQr();
				const json = await runHtml(Readability, imageTableHtml, { unwrapImageTables: true });
				const content = json.content as string;
				expect(content).to.include('image-inside-table.png');
				expect(content).to.not.match(/<table[\s>][\s\S]*image-inside-table\.png/);
			});

			it('should NOT hoist images out of multi-img tables', async function () {
				const { Readability } = loadWithStubbedQr();
				const json = await runHtml(Readability, imageTableHtml, { unwrapImageTables: true });
				const content = json.content as string;
				// If Readability kept the multi-img table's images, they must still be
				// inside a <table>, not unwrapped. Readability may also remove the
				// table entirely as non-article chrome; either outcome is acceptable.
				const hasA = content.includes('a.png');
				const hasB = content.includes('b.png');
				if (hasA || hasB) {
					expect(content).to.match(/<table[\s\S]*(?:a\.png|b\.png)[\s\S]*<\/table>/);
				}
			});
		});

		describe("videos: 'remove'", function () {
			it('should strip <video>, known-host iframes, and video placeholder imgs', async function () {
				const { Readability } = loadWithStubbedQr();
				const json = await runHtml(Readability, videoHtml, { videos: 'remove' });
				const content = json.content as string;
				expect(content).to.not.include('<video');
				expect(content).to.not.include('<iframe');
				expect(content).to.not.include('data-component-name="VideoPlaceholder"');
			});

			it('should refresh textContent and length', async function () {
				const { Readability } = loadWithStubbedQr();
				const json = await runHtml(Readability, videoHtml, { videos: 'remove' });
				expect(json.textContent).to.be.a('string');
				expect(json.length).to.equal((json.textContent as string).length);
			});
		});

		describe("videos: 'qr'", function () {
			it('should replace each video with a <p class="qr-for-video"> wrapper', async function () {
				const { Readability, qrCallLog } = loadWithStubbedQr();
				const json = await runHtml(Readability, videoHtml, { videos: 'qr' });
				const content = json.content as string;
				expect(content).to.include('class="qr-for-video"');
				expect(content).to.include('data-test="qr"');
				expect(content).to.not.include('<video');
				expect(content).to.not.include('<iframe');
				expect(qrCallLog.length).to.be.greaterThan(0);
			});

			it('should prefer anchor href over the inner element src for QR URL', async function () {
				const { Readability, qrCallLog } = loadWithStubbedQr();
				await runHtml(Readability, videoHtml, { videos: 'qr' });
				expect(qrCallLog).to.include('https://youtu.be/abc123');
			});

			it('should use the iframe src when no enclosing anchor is present', async function () {
				const { Readability, qrCallLog } = loadWithStubbedQr();
				await runHtml(Readability, videoHtml, { videos: 'qr' });
				expect(qrCallLog).to.include('https://www.youtube.com/embed/xyz789');
			});

			it('should remove (not QR-replace) a video element with no URL', async function () {
				const html = `<!DOCTYPE html><html><body><article><h1>T</h1>${
					'<p>padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding.</p>'.repeat(
						6,
					)
				}<p><video></video></p></article></body></html>`;
				const { Readability, qrCallLog } = loadWithStubbedQr();
				const json = await runHtml(Readability, html, { videos: 'qr' });
				const content = json.content as string;
				expect(content).to.not.include('<video');
				expect(qrCallLog).to.have.lengthOf(0);
			});
		});

		describe("removeLinks: 'unwrap'", function () {
			it('should remove <a> tags while preserving their text', async function () {
				const { Readability } = loadWithStubbedQr();
				const json = await runHtml(Readability, linksHtml, { removeLinks: 'unwrap' });
				const content = json.content as string;
				expect(content).to.not.match(/<a\s/);
				expect(content).to.include('one');
				expect(content).to.include('two');
				expect(content).to.include('three');
			});
		});

		describe("removeLinks: 'strip'", function () {
			it('should remove <a> tags AND their child text', async function () {
				const { Readability } = loadWithStubbedQr();
				const json = await runHtml(Readability, linksHtml, { removeLinks: 'strip' });
				const content = json.content as string;
				expect(content).to.not.match(/<a\s/);
				expect(content).to.not.include('>one<');
				expect(content).to.not.include('>two<');
				expect(content).to.not.include('>three<');
			});

			it('should refresh textContent and length to match the stripped content', async function () {
				const { Readability } = loadWithStubbedQr();
				const json = await runHtml(Readability, linksHtml, { removeLinks: 'strip' });
				expect(json.textContent).to.be.a('string');
				expect(json.length).to.equal((json.textContent as string).length);
			});
		});

		describe("combined videos:'remove' + removeLinks:'strip'", function () {
			it('should apply both and report textContent/length reflecting both', async function () {
				const { Readability } = loadWithStubbedQr();
				const json = await runHtml(Readability, videoHtml, {
					videos: 'remove',
					removeLinks: 'strip',
				});
				const content = json.content as string;
				expect(content).to.not.include('<video');
				expect(content).to.not.match(/<a\s/);
				expect(json.length).to.equal((json.textContent as string).length);
			});
		});
	});
});
