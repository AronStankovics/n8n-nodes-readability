/*
 * Unit tests for nodes/Readability/post/images.ts. These exist primarily
 * because Mozilla Readability strips most layout tables before they reach
 * our post-processor, so the execute-level integration tests never actually
 * exercise unwrapImageTables end-to-end.
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

import { unwrapImageTables } from '../../nodes/Readability/post/images';

function makeContainer(innerHtml: string): HTMLElement {
	const doc = new JSDOM(`<!DOCTYPE html><html><body><div></div></body></html>`).window.document;
	const container = doc.querySelector('div') as HTMLElement;
	container.innerHTML = innerHtml;
	return container;
}

describe('nodes/Readability/post/images.ts', () => {
	describe('#unwrapImageTables(container)', () => {
		it('should replace a single-image table with a clone of the image', () => {
			const container = makeContainer(
				'<table><tr><td><img src="https://ex.com/a.png" alt="A"></td></tr></table>',
			);
			unwrapImageTables(container);
			expect(container.querySelector('table')).toBeNull();
			const img = container.querySelector('img');
			expect(img?.getAttribute('src')).toBe('https://ex.com/a.png');
			expect(img?.getAttribute('alt')).toBe('A');
		});

		it('should leave multi-image tables untouched', () => {
			const before =
				'<table><tr><td><img src="https://ex.com/a.png"></td><td><img src="https://ex.com/b.png"></td></tr></table>';
			const container = makeContainer(before);
			unwrapImageTables(container);
			expect(container.querySelector('table')).not.toBeNull();
			expect(container.querySelectorAll('img')).toHaveLength(2);
		});

		it('should leave tables with zero images untouched', () => {
			const before = '<table><tr><td>text</td></tr></table>';
			const container = makeContainer(before);
			unwrapImageTables(container);
			expect(container.querySelector('table')).not.toBeNull();
			expect(container.textContent).toContain('text');
		});

		it('should handle multiple single-image tables independently', () => {
			const container = makeContainer(
				'<table><tr><td><img src="https://ex.com/a.png"></td></tr></table>' +
					'<p>separator</p>' +
					'<table><tr><td><img src="https://ex.com/b.png"></td></tr></table>',
			);
			unwrapImageTables(container);
			expect(container.querySelectorAll('table')).toHaveLength(0);
			const imgs = Array.from(container.querySelectorAll('img')).map((i) => i.getAttribute('src'));
			expect(imgs).toEqual(['https://ex.com/a.png', 'https://ex.com/b.png']);
		});

		it('should preserve image attributes via deep clone', () => {
			const container = makeContainer(
				'<table><tr><td><img src="https://ex.com/a.png" alt="A" width="400" data-test="keep"></td></tr></table>',
			);
			unwrapImageTables(container);
			const img = container.querySelector('img') as HTMLImageElement;
			expect(img.getAttribute('src')).toBe('https://ex.com/a.png');
			expect(img.getAttribute('alt')).toBe('A');
			expect(img.getAttribute('width')).toBe('400');
			expect(img.getAttribute('data-test')).toBe('keep');
		});

		it('should count nested <img> tags — a table with one nested image gets unwrapped', () => {
			const container = makeContainer(
				'<table><tr><td><figure><img src="https://ex.com/nested.png"></figure></td></tr></table>',
			);
			unwrapImageTables(container);
			expect(container.querySelector('table')).toBeNull();
			expect(container.querySelector('figure')).toBeNull();
			expect(container.querySelector('img')?.getAttribute('src')).toBe('https://ex.com/nested.png');
		});

		it('should unwrap both outer and inner tables when nested with single images each', () => {
			const container = makeContainer(
				'<table><tr><td><table><tr><td><img src="https://ex.com/inner.png"></td></tr></table></td></tr></table>',
			);
			unwrapImageTables(container);
			expect(container.querySelector('table')).toBeNull();
			expect(container.querySelector('img')?.getAttribute('src')).toBe(
				'https://ex.com/inner.png',
			);
		});

		it('should be a no-op when the container has no tables', () => {
			const before = '<p>Nothing to unwrap</p><img src="https://ex.com/a.png">';
			const container = makeContainer(before);
			unwrapImageTables(container);
			expect(container.innerHTML).toBe(before);
		});
	});
});
