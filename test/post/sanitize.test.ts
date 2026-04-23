/*
 * Unit tests for nodes/Readability/post/sanitize.ts. The sanitize stage is
 * the final pass that runs DOMPurify over the post-processed HTML so
 * downstream renderers (email, Notion, webhook consumers) can treat the
 * output as safe.
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

import { sanitize } from '../../nodes/Readability/post/sanitize';

function makeSetup(innerHtml: string): { container: HTMLElement; doc: Document } {
	// Use a concrete URL so the document is not an opaque origin — JSDOM's form
	// element wiring pokes window.localStorage during DOMPurify's sanitize pass,
	// and opaque origins (about:blank) reject that access.
	const doc = new JSDOM('<!DOCTYPE html><html><body><div></div></body></html>', {
		url: 'http://localhost/',
	}).window.document;
	const container = doc.querySelector('div') as HTMLElement;
	container.innerHTML = innerHtml;
	return { container, doc };
}

describe('nodes/Readability/post/sanitize.ts', () => {
	describe('#sanitize(container, doc)', () => {
		it('should strip <script> tags', () => {
			const { container, doc } = makeSetup('<p>hi</p><script>alert(1)</script>');
			sanitize(container, doc);
			expect(container.querySelector('script')).toBeNull();
			expect(container.textContent).toBe('hi');
		});

		it('should remove inline event handler attributes', () => {
			const { container, doc } = makeSetup(
				'<a href="https://ex.com" onclick="alert(1)" onmouseover="x()">link</a>',
			);
			sanitize(container, doc);
			const a = container.querySelector('a');
			expect(a).not.toBeNull();
			expect(a!.getAttribute('onclick')).toBeNull();
			expect(a!.getAttribute('onmouseover')).toBeNull();
			expect(a!.getAttribute('href')).toBe('https://ex.com');
		});

		it('should strip javascript: URLs from href', () => {
			const { container, doc } = makeSetup(
				'<a href="javascript:alert(1)">bad</a><a href="https://ex.com">good</a>',
			);
			sanitize(container, doc);
			const anchors = Array.from(container.querySelectorAll('a'));
			for (const a of anchors) {
				const href = a.getAttribute('href');
				if (href !== null) {
					expect(href.toLowerCase()).not.toContain('javascript:');
				}
			}
			const good = anchors.find((a) => a.textContent === 'good');
			expect(good?.getAttribute('href')).toBe('https://ex.com');
		});

		it('should strip <iframe> elements by default', () => {
			const { container, doc } = makeSetup(
				'<iframe src="https://evil.example.com"></iframe><p>keep</p>',
			);
			sanitize(container, doc);
			expect(container.querySelector('iframe')).toBeNull();
			expect(container.textContent).toContain('keep');
		});

		it('should strip <object> and <embed> elements', () => {
			const { container, doc } = makeSetup(
				'<object data="evil.swf"></object><embed src="evil.swf"><p>keep</p>',
			);
			sanitize(container, doc);
			expect(container.querySelector('object')).toBeNull();
			expect(container.querySelector('embed')).toBeNull();
			expect(container.textContent).toContain('keep');
		});

		it('should preserve benign article HTML (headings, anchors, images, emphasis)', () => {
			const { container, doc } = makeSetup(
				'<h1>Title</h1><p>Hello <strong>world</strong> <em>italic</em> <a href="https://ex.com">link</a></p><img src="https://ex.com/a.png" alt="a">',
			);
			sanitize(container, doc);
			expect(container.querySelector('h1')?.textContent).toBe('Title');
			expect(container.querySelector('strong')?.textContent).toBe('world');
			expect(container.querySelector('em')?.textContent).toBe('italic');
			expect(container.querySelector('a')?.getAttribute('href')).toBe('https://ex.com');
			expect(container.querySelector('img')?.getAttribute('src')).toBe('https://ex.com/a.png');
			expect(container.querySelector('img')?.getAttribute('alt')).toBe('a');
		});

		it('should preserve inline <svg> (so the QR-for-video replacement survives)', () => {
			const { container, doc } = makeSetup(
				'<p class="qr-for-video" style="text-align: center"><svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128"></rect></svg></p>',
			);
			sanitize(container, doc);
			const wrapper = container.querySelector('p.qr-for-video');
			expect(wrapper).not.toBeNull();
			expect(wrapper!.querySelector('svg')).not.toBeNull();
			expect(wrapper!.querySelector('svg rect')).not.toBeNull();
		});

		it('should strip <script> nested inside <svg>', () => {
			const { container, doc } = makeSetup(
				'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>',
			);
			sanitize(container, doc);
			expect(container.querySelector('script')).toBeNull();
		});

		it('should be idempotent', () => {
			const { container, doc } = makeSetup(
				'<p>Hello <strong>world</strong></p><script>alert(1)</script><a href="javascript:void(0)">x</a>',
			);
			sanitize(container, doc);
			const once = container.innerHTML;
			sanitize(container, doc);
			expect(container.innerHTML).toBe(once);
		});

		it('should leave a container with only safe content unchanged', () => {
			const before = '<p>hello <strong>world</strong></p>';
			const { container, doc } = makeSetup(before);
			sanitize(container, doc);
			expect(container.innerHTML).toBe(before);
		});
	});
});
