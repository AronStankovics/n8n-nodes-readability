/*
 * Unit tests for nodes/Readability/post/pipeline.ts — the orchestrator that
 * wires images, videos, and links into a single post-processing pass.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

const qrState = vi.hoisted(() => ({ callLog: [] as string[] }));

vi.mock('qrcode', () => {
	const toString = async (url: string) => {
		qrState.callLog.push(url);
		return `<svg xmlns="http://www.w3.org/2000/svg" data-url="${url}"></svg>`;
	};
	return { default: { toString }, toString };
});

import { needsPostProcess, runPostProcess } from '../../nodes/Readability/post/pipeline';

function makeDoc(): Document {
	return new JSDOM('<!DOCTYPE html><html><body></body></html>').window.document;
}

beforeEach(() => {
	qrState.callLog = [];
});

describe('nodes/Readability/post/pipeline.ts', () => {
	describe('#needsPostProcess(opts)', () => {
		it('should return false for empty options', () => {
			expect(needsPostProcess({})).toBe(false);
		});

		it('should return false when every mode-style option is "keep"', () => {
			expect(needsPostProcess({ videos: 'keep', removeLinks: 'keep' })).toBe(false);
		});

		it('should return true when unwrapImageTables is enabled', () => {
			expect(needsPostProcess({ unwrapImageTables: true })).toBe(true);
		});

		it('should return false when unwrapImageTables is explicitly false', () => {
			expect(needsPostProcess({ unwrapImageTables: false })).toBe(false);
		});

		it('should return true when videos is "remove" or "qr"', () => {
			expect(needsPostProcess({ videos: 'remove' })).toBe(true);
			expect(needsPostProcess({ videos: 'qr' })).toBe(true);
		});

		it('should return true when removeLinks is "unwrap" or "strip"', () => {
			expect(needsPostProcess({ removeLinks: 'unwrap' })).toBe(true);
			expect(needsPostProcess({ removeLinks: 'strip' })).toBe(true);
		});
	});

	describe('#runPostProcess(content, doc, opts)', () => {
		it('should refresh textContent and length to match the post-processed DOM', async () => {
			const doc = makeDoc();
			const result = await runPostProcess(
				'<p>Hello <a href="https://ex.com">world</a>.</p>',
				doc,
				{ removeLinks: 'strip' },
			);
			expect(result.content).not.toMatch(/<a\s/);
			expect(result.textContent).toBe('Hello .');
			expect(result.length).toBe(result.textContent.length);
		});

		it('should run images → videos → links in that order', async () => {
			// A single-image table inside an anchor: unwrapping the table first
			// exposes an <a> containing only the image, which strip can then remove.
			const doc = makeDoc();
			const result = await runPostProcess(
				'<a href="https://ex.com"><table><tr><td><img src="https://ex.com/a.png"></td></tr></table></a>',
				doc,
				{ unwrapImageTables: true, removeLinks: 'strip' },
			);
			expect(result.content).not.toMatch(/<table/);
			expect(result.content).not.toMatch(/<a\s/);
			// strip removes the anchor AND its child, so the image is gone too.
			expect(result.content).not.toContain('<img');
		});

		it('should apply only the enabled stages', async () => {
			const doc = makeDoc();
			const result = await runPostProcess(
				'<p><a href="https://ex.com">keep</a> <video src="https://cdn/x.mp4"></video></p>',
				doc,
				{ videos: 'remove' },
			);
			expect(result.content).not.toContain('<video');
			expect(result.content).toMatch(/<a\s/);
		});

		it('should parallelize QR generation across videos', async () => {
			const doc = makeDoc();
			await runPostProcess(
				'<video src="https://cdn/a.mp4"></video>' +
					'<video src="https://cdn/b.mp4"></video>',
				doc,
				{ videos: 'qr' },
			);
			expect(qrState.callLog.sort()).toEqual(['https://cdn/a.mp4', 'https://cdn/b.mp4'].sort());
		});

		it('should treat "keep" modes as no-ops', async () => {
			const doc = makeDoc();
			const result = await runPostProcess(
				'<p><a href="https://ex.com">link</a></p>',
				doc,
				{ videos: 'keep', removeLinks: 'keep' },
			);
			expect(result.content).toMatch(/<a\s/);
			expect(result.content).toContain('link');
		});

		it('should return textContent and length refreshed even for stages that do not remove text (e.g. unwrapImageTables)', async () => {
			const doc = makeDoc();
			const html =
				'<p>Intro.</p><table><tr><td><img src="https://ex.com/a.png" alt="Alt Text"></td></tr></table><p>Outro.</p>';
			const result = await runPostProcess(html, doc, { unwrapImageTables: true });
			expect(result.content).not.toContain('<table');
			expect(result.textContent).toBe('Intro.Outro.');
			expect(result.length).toBe(result.textContent.length);
		});
	});
});
