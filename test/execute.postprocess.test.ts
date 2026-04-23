/*
 * Tests for the HTML post-processing branches: unwrapImageTables, videos
 * (keep/remove/qr), and removeLinks (keep/unwrap/strip), including their
 * interactions and the textContent/length refresh semantics.
 *
 * Uses vi.mock to swap the `qrcode` module with a stub returning a
 * deterministic SVG so tests are fast and hermetic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const qrState = vi.hoisted(() => ({
	callLog: [] as string[],
	fakeSvg:
		'<svg xmlns="http://www.w3.org/2000/svg" data-test="qr" width="128" height="128"><rect width="128" height="128"/></svg>',
}));

vi.mock('qrcode', () => {
	const toString = async (url: string) => {
		qrState.callLog.push(url);
		return qrState.fakeSvg;
	};
	return {
		default: { toString },
		toString,
	};
});

// Import after vi.mock so the hoisted mock applies.
import { Readability } from '../nodes/Readability/Readability.node';
import { createMockExecuteFunctions } from './mock-execute-functions';
import { imageTableHtml, linksHtml, longParagraphs, videoHtml } from './test-data';

async function runHtml(html: string, options: Record<string, unknown>, baseUrl = '') {
	const mock = createMockExecuteFunctions({
		params: { inputSource: 'html', html, baseUrl, options },
	});
	const result = (await new Readability().execute.call(mock)) as Array<
		Array<{ json: Record<string, unknown> }>
	>;
	return result[0][0].json;
}

beforeEach(() => {
	qrState.callLog = [];
});

describe('nodes/Readability/Readability.node.ts', () => {
	describe('#execute (post-processing)', () => {
		describe('unwrapImageTables', () => {
			it('should replace a single-img <table> with a clone of the <img>', async () => {
				const json = await runHtml(imageTableHtml, { unwrapImageTables: true });
				const content = json.content as string;
				expect(content).toContain('image-inside-table.png');
				expect(content).not.toMatch(/<table[\s>][\s\S]*image-inside-table\.png/);
			});

			it('should NOT hoist images out of multi-img tables', async () => {
				const json = await runHtml(imageTableHtml, { unwrapImageTables: true });
				const content = json.content as string;
				// If Readability kept the multi-img table's images, they must still be
				// inside a <table>, not unwrapped. Readability may also remove the
				// table entirely as non-article chrome; either outcome is acceptable.
				const hasA = content.includes('a.png');
				const hasB = content.includes('b.png');
				if (hasA || hasB) {
					expect(content).toMatch(/<table[\s\S]*(?:a\.png|b\.png)[\s\S]*<\/table>/);
				}
			});
		});

		describe("videos: 'remove'", () => {
			it('should strip <video>, known-host iframes, and video placeholder imgs', async () => {
				const json = await runHtml(videoHtml, { videos: 'remove' });
				const content = json.content as string;
				expect(content).not.toContain('<video');
				expect(content).not.toContain('<iframe');
				expect(content).not.toContain('data-component-name="VideoPlaceholder"');
			});

			it('should refresh textContent and length', async () => {
				const json = await runHtml(videoHtml, { videos: 'remove' });
				expect(typeof json.textContent).toBe('string');
				expect(json.length).toBe((json.textContent as string).length);
			});
		});

		describe("videos: 'qr'", () => {
			it('should replace each video with a <p class="qr-for-video"> wrapper', async () => {
				const json = await runHtml(videoHtml, { videos: 'qr' });
				const content = json.content as string;
				expect(content).toContain('class="qr-for-video"');
				expect(content).toContain('data-test="qr"');
				expect(content).not.toContain('<video');
				expect(content).not.toContain('<iframe');
				expect(qrState.callLog.length).toBeGreaterThan(0);
			});

			it('should prefer anchor href over the inner element src for QR URL', async () => {
				await runHtml(videoHtml, { videos: 'qr' });
				expect(qrState.callLog).toContain('https://youtu.be/abc123');
			});

			it('should use the iframe src when no enclosing anchor is present', async () => {
				await runHtml(videoHtml, { videos: 'qr' });
				expect(qrState.callLog).toContain('https://www.youtube.com/embed/xyz789');
			});

			it('should remove (not QR-replace) a video element with no URL', async () => {
				const html = `<!DOCTYPE html><html><body><article><h1>T</h1>${
					'<p>padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding.</p>'.repeat(
						6,
					)
				}<p><video></video></p></article></body></html>`;
				const json = await runHtml(html, { videos: 'qr' });
				const content = json.content as string;
				expect(content).not.toContain('<video');
				expect(qrState.callLog).toHaveLength(0);
			});
		});

		describe("removeLinks: 'unwrap'", () => {
			it('should remove <a> tags while preserving their text', async () => {
				const json = await runHtml(linksHtml, { removeLinks: 'unwrap' });
				const content = json.content as string;
				expect(content).not.toMatch(/<a\s/);
				expect(content).toContain('one');
				expect(content).toContain('two');
				expect(content).toContain('three');
			});
		});

		describe("removeLinks: 'strip'", () => {
			it('should remove <a> tags AND their child text', async () => {
				const json = await runHtml(linksHtml, { removeLinks: 'strip' });
				const content = json.content as string;
				expect(content).not.toMatch(/<a\s/);
				expect(content).not.toContain('>one<');
				expect(content).not.toContain('>two<');
				expect(content).not.toContain('>three<');
			});

			it('should refresh textContent and length to match the stripped content', async () => {
				const json = await runHtml(linksHtml, { removeLinks: 'strip' });
				expect(typeof json.textContent).toBe('string');
				expect(json.length).toBe((json.textContent as string).length);
			});
		});

		describe('sanitize', () => {
			const dirtyArticle = `<!DOCTYPE html><html><body><article><h1>T</h1>${longParagraphs(
				4,
			)}<p>See <a href="https://ex.com" onclick="alert(1)">link</a>.</p>${longParagraphs(
				2,
			)}</article></body></html>`;

			it('should strip inline event handlers when sanitize is true', async () => {
				const json = await runHtml(dirtyArticle, { sanitize: true });
				expect(json.readable).toBe(true);
				expect(json.content as string).not.toMatch(/onclick/i);
				expect(json.content as string).toMatch(/href="https:\/\/ex\.com\/?"/);
			});

			it('should leave inline event handlers intact when sanitize is false', async () => {
				const json = await runHtml(dirtyArticle, { sanitize: false });
				expect(json.content as string).toMatch(/onclick/i);
			});

			it('should refresh textContent and length after sanitization', async () => {
				const json = await runHtml(dirtyArticle, { sanitize: true });
				expect(json.length).toBe((json.textContent as string).length);
			});
		});

		describe("combined videos:'remove' + removeLinks:'strip'", () => {
			it('should apply both and report textContent/length reflecting both', async () => {
				const json = await runHtml(videoHtml, {
					videos: 'remove',
					removeLinks: 'strip',
				});
				const content = json.content as string;
				expect(content).not.toContain('<video');
				expect(content).not.toMatch(/<a\s/);
				expect(json.length).toBe((json.textContent as string).length);
			});
		});
	});
});
