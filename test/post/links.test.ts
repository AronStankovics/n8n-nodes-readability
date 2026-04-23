/*
 * Unit tests for nodes/Readability/post/links.ts.
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

import {
	isTrackingParam,
	processLinks,
	stripTrackingFromUrl,
	stripTrackingParams,
} from '../../nodes/Readability/post/links';

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

	describe('#isTrackingParam(name)', () => {
		it('should match every utm_* key', () => {
			for (const key of [
				'utm_source',
				'utm_medium',
				'utm_campaign',
				'utm_term',
				'utm_content',
				'utm_id',
				'utm_anything_custom',
			]) {
				expect(isTrackingParam(key), key).toBe(true);
			}
		});

		it('should match well-known click identifiers across ad networks', () => {
			for (const key of [
				'fbclid',
				'gclid',
				'gclsrc',
				'dclid',
				'gbraid',
				'wbraid',
				'msclkid',
				'yclid',
				'igshid',
				'mc_cid',
				'mc_eid',
				'mkt_tok',
				'_hsenc',
				'_hsmi',
				'__hssc',
				'__hstc',
				'__hsfp',
				'vero_id',
				'vero_conv',
				'_openstat',
				'oly_anon_id',
				'oly_enc_id',
				'pk_campaign',
				'piwik_campaign',
				'ref_src',
			]) {
				expect(isTrackingParam(key), key).toBe(true);
			}
		});

		it('should NOT match common content-bearing query parameters', () => {
			for (const key of ['id', 'page', 'q', 'ref', 'utmost', 'futm_source', 'lang']) {
				expect(isTrackingParam(key), key).toBe(false);
			}
		});
	});

	describe('#stripTrackingFromUrl(url)', () => {
		it('should drop tracking parameters from an absolute URL', () => {
			expect(
				stripTrackingFromUrl(
					'https://example.com/page?utm_source=newsletter&utm_medium=email&id=42',
				),
			).toBe('https://example.com/page?id=42');
		});

		it('should drop the entire query string when only tracking params remain', () => {
			expect(stripTrackingFromUrl('https://example.com/page?utm_source=x&fbclid=y')).toBe(
				'https://example.com/page',
			);
		});

		it('should preserve URLs that contain no tracking parameters byte-for-byte', () => {
			const url = 'https://example.com/path?id=42&q=hello+world#section';
			expect(stripTrackingFromUrl(url)).toBe(url);
		});

		it('should preserve URLs with no query string', () => {
			expect(stripTrackingFromUrl('https://example.com/path#anchor')).toBe(
				'https://example.com/path#anchor',
			);
			expect(stripTrackingFromUrl('https://example.com/')).toBe('https://example.com/');
		});

		it('should keep the URL fragment when stripping tracking params', () => {
			expect(
				stripTrackingFromUrl('https://example.com/page?utm_source=x&id=1#sec'),
			).toBe('https://example.com/page?id=1#sec');
			expect(stripTrackingFromUrl('https://example.com/page?utm_source=x#sec')).toBe(
				'https://example.com/page#sec',
			);
		});

		it('should work on relative URLs', () => {
			expect(stripTrackingFromUrl('/path?utm_source=x&id=1')).toBe('/path?id=1');
			expect(stripTrackingFromUrl('/path?utm_source=x')).toBe('/path');
			expect(stripTrackingFromUrl('?utm_source=x&keep=1')).toBe('?keep=1');
		});

		it('should preserve repeated keys when only one is tracking', () => {
			expect(
				stripTrackingFromUrl('https://example.com/?tag=a&utm_source=x&tag=b'),
			).toBe('https://example.com/?tag=a&tag=b');
		});

		it('should leave non-HTTP schemes untouched', () => {
			expect(stripTrackingFromUrl('mailto:test@example.com?subject=hi')).toBe(
				'mailto:test@example.com?subject=hi',
			);
			expect(stripTrackingFromUrl('tel:+15551234567')).toBe('tel:+15551234567');
		});

		it('should return malformed input unchanged instead of throwing', () => {
			expect(stripTrackingFromUrl('not a url')).toBe('not a url');
			expect(stripTrackingFromUrl('')).toBe('');
		});
	});

	describe('#stripTrackingParams(container)', () => {
		it('should strip tracking params from every <a href>', () => {
			const container = makeContainer(
				'<p><a href="https://ex.com/a?utm_source=foo&id=1">one</a> ' +
					'<a href="https://ex.com/b?fbclid=zzz">two</a></p>',
			);
			stripTrackingParams(container);
			const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
			expect(hrefs).toEqual(['https://ex.com/a?id=1', 'https://ex.com/b']);
		});

		it('should leave anchors with no tracking params untouched', () => {
			const before = '<p><a href="https://ex.com/x?id=1">x</a></p>';
			const container = makeContainer(before);
			stripTrackingParams(container);
			expect(container.innerHTML).toBe(before);
		});

		it('should ignore anchors without an href attribute', () => {
			const before = '<p><a name="bookmark">anchor</a></p>';
			const container = makeContainer(before);
			stripTrackingParams(container);
			expect(container.innerHTML).toBe(before);
		});

		it('should preserve link text and child elements', () => {
			const container = makeContainer(
				'<p><a href="https://ex.com/?utm_source=x"><strong>bold</strong> text</a></p>',
			);
			stripTrackingParams(container);
			const a = container.querySelector('a')!;
			expect(a.getAttribute('href')).toBe('https://ex.com/');
			expect(a.querySelector('strong')?.textContent).toBe('bold');
			expect(a.textContent).toBe('bold text');
		});

		it('should be a no-op when the container has no anchors', () => {
			const before = '<p>plain</p>';
			const container = makeContainer(before);
			stripTrackingParams(container);
			expect(container.innerHTML).toBe(before);
		});
	});
});
