/*
 * Unit tests for nodes/Readability/post/links.ts.
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

import { processLinks } from '../../nodes/Readability/post/links';

function makeContainer(innerHtml: string): HTMLElement {
	const doc = new JSDOM(`<!DOCTYPE html><html><body><div></div></body></html>`).window.document;
	const container = doc.querySelector('div') as HTMLElement;
	container.innerHTML = innerHtml;
	return container;
}

describe('nodes/Readability/post/links.ts', () => {
	describe('#processLinks(container, mode=unwrap)', () => {
		it('should remove <a> tags while keeping their text children', () => {
			const container = makeContainer(
				'<p>See <a href="https://ex.com/a">one</a>, <a href="https://ex.com/b">two</a>.</p>',
			);
			processLinks(container, 'unwrap');
			expect(container.querySelectorAll('a')).toHaveLength(0);
			expect(container.textContent).toBe('See one, two.');
		});

		it('should preserve element children inside unwrapped anchors', () => {
			const container = makeContainer(
				'<p><a href="https://ex.com/a"><strong>bold</strong> and <em>italic</em></a></p>',
			);
			processLinks(container, 'unwrap');
			expect(container.querySelectorAll('a')).toHaveLength(0);
			expect(container.querySelector('strong')?.textContent).toBe('bold');
			expect(container.querySelector('em')?.textContent).toBe('italic');
		});

		it('should handle anchors with no children', () => {
			const container = makeContainer('<p>before<a href="https://ex.com/a"></a>after</p>');
			processLinks(container, 'unwrap');
			expect(container.querySelectorAll('a')).toHaveLength(0);
			expect(container.textContent).toBe('beforeafter');
		});

		it('should handle nested anchors', () => {
			const container = makeContainer(
				'<p><a href="https://outer"><a href="https://inner">text</a></a></p>',
			);
			processLinks(container, 'unwrap');
			expect(container.querySelectorAll('a')).toHaveLength(0);
			expect(container.textContent).toBe('text');
		});
	});

	describe('#processLinks(container, mode=strip)', () => {
		it('should remove <a> tags and all their descendants', () => {
			const container = makeContainer(
				'<p>See <a href="https://ex.com/a">one</a>, <a href="https://ex.com/b">two</a>.</p>',
			);
			processLinks(container, 'strip');
			expect(container.querySelectorAll('a')).toHaveLength(0);
			expect(container.textContent).toBe('See , .');
		});

		it('should strip nested element children along with the anchor', () => {
			const container = makeContainer(
				'<p><a href="https://ex.com"><strong>gone</strong></a> kept</p>',
			);
			processLinks(container, 'strip');
			expect(container.querySelectorAll('a')).toHaveLength(0);
			expect(container.querySelector('strong')).toBeNull();
			expect(container.textContent).toBe(' kept');
		});

		it('should leave non-anchor content alone', () => {
			const container = makeContainer('<p>plain</p><img src="https://ex.com/a.png">');
			const before = container.innerHTML;
			processLinks(container, 'strip');
			expect(container.innerHTML).toBe(before);
		});
	});

	it('should be a no-op when the container has no anchors', () => {
		const before = '<p>plain</p><img src="https://ex.com/a.png">';
		const container = makeContainer(before);
		processLinks(container, 'unwrap');
		expect(container.innerHTML).toBe(before);
		processLinks(container, 'strip');
		expect(container.innerHTML).toBe(before);
	});
});
