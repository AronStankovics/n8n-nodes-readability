/*
 * Unit tests for the three exported helper functions in Readability.node.ts.
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

import {
	buildQrReplacement,
	outerVideoContainer,
	resolveVideoUrl,
} from '../nodes/Readability/Readability.node';

function makeDoc(bodyHtml: string = ''): Document {
	return new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`).window.document;
}

describe('nodes/Readability/Readability.node.ts', () => {
	describe('#resolveVideoUrl(el)', () => {
		it('should return the href of the enclosing anchor when present', () => {
			const doc = makeDoc(
				'<a href="https://example.com/watch"><img data-component-name="VideoPlaceholder" src="https://thumb.example.com/t.jpg"></a>',
			);
			const el = doc.querySelector('img') as Element;
			expect(resolveVideoUrl(el)).toBe('https://example.com/watch');
		});

		it('should prefer the nearest ancestor anchor and ignore siblings', () => {
			const doc = makeDoc(
				'<a href="https://sibling.example.com/x">sibling</a><div><a href="https://ancestor.example.com/y"><video src="https://cdn.example.com/v.mp4"></video></a></div>',
			);
			const video = doc.querySelector('video') as Element;
			expect(resolveVideoUrl(video)).toBe('https://ancestor.example.com/y');
		});

		it('should return the <video> src attribute when no anchor is present', () => {
			const doc = makeDoc('<video src="https://cdn.example.com/direct.mp4"></video>');
			const video = doc.querySelector('video') as Element;
			expect(resolveVideoUrl(video)).toBe('https://cdn.example.com/direct.mp4');
		});

		it('should fall back to the first <source> child src when <video> has no src', () => {
			const doc = makeDoc(
				'<video><source src="https://cdn.example.com/source.mp4" type="video/mp4"><source src="https://cdn.example.com/second.mp4"></video>',
			);
			const video = doc.querySelector('video') as Element;
			expect(resolveVideoUrl(video)).toBe('https://cdn.example.com/source.mp4');
		});

		it('should return null when <video> has neither src nor source children', () => {
			const doc = makeDoc('<video></video>');
			const video = doc.querySelector('video') as Element;
			expect(resolveVideoUrl(video)).toBeNull();
		});

		it('should return the src attribute for non-video elements (iframe) when no anchor', () => {
			const doc = makeDoc('<iframe src="https://www.youtube.com/embed/abc"></iframe>');
			const iframe = doc.querySelector('iframe') as Element;
			expect(resolveVideoUrl(iframe)).toBe('https://www.youtube.com/embed/abc');
		});

		it('should return the src attribute for img elements when no anchor', () => {
			const doc = makeDoc('<img data-component-name="Video" src="https://thumb/x.jpg">');
			const img = doc.querySelector('img') as Element;
			expect(resolveVideoUrl(img)).toBe('https://thumb/x.jpg');
		});
	});

	describe('#outerVideoContainer(el)', () => {
		it('should return the element itself when parent is neither <a> nor a sole-child <p>', () => {
			const doc = makeDoc('<div><video src="https://cdn/v.mp4"></video></div>');
			const video = doc.querySelector('video') as Element;
			expect(outerVideoContainer(video)).toBe(video);
		});

		it('should expand to the anchor when parent is an <a>', () => {
			const doc = makeDoc('<div><a href="https://ex.com/x"><video src="https://cdn/v.mp4"></video></a></div>');
			const video = doc.querySelector('video') as Element;
			const anchor = doc.querySelector('a') as Element;
			expect(outerVideoContainer(video)).toBe(anchor);
		});

		it('should expand through <a> and a sole-child <p> when text content matches', () => {
			const doc = makeDoc('<p><a href="https://ex.com/x"><video src="https://cdn/v.mp4"></video></a></p>');
			const video = doc.querySelector('video') as Element;
			const paragraph = doc.querySelector('p') as Element;
			expect(outerVideoContainer(video)).toBe(paragraph);
		});

		it('should NOT expand to <p> when it has additional children', () => {
			const doc = makeDoc('<p><video src="https://cdn/v.mp4"></video><span>extra</span></p>');
			const video = doc.querySelector('video') as Element;
			expect(outerVideoContainer(video)).toBe(video);
		});

		it('should NOT expand to <p> when paragraph has surrounding text siblings', () => {
			const doc = makeDoc('<p>prefix <video src="https://cdn/v.mp4"></video></p>');
			const video = doc.querySelector('video') as Element;
			expect(outerVideoContainer(video)).toBe(video);
		});
	});

	describe('#buildQrReplacement(doc, svgMarkup)', () => {
		it('should wrap the SVG in a <p class="qr-for-video" style="text-align: center">', () => {
			const doc = makeDoc();
			const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
			const wrapper = buildQrReplacement(doc, svg);
			expect(wrapper.tagName).toBe('P');
			expect(wrapper.getAttribute('class')).toBe('qr-for-video');
			expect(wrapper.getAttribute('style')).toBe('text-align: center');
			expect(wrapper.querySelector('svg')).not.toBeNull();
		});

		it('should strip non-svg content from the input markup', () => {
			const doc = makeDoc();
			const wrapper = buildQrReplacement(
				doc,
				'<div>junk</div><svg xmlns="http://www.w3.org/2000/svg"><rect data-test="keep"/></svg><span>after</span>',
			);
			expect(wrapper.children).toHaveLength(1);
			expect(wrapper.children[0].tagName.toLowerCase()).toBe('svg');
			expect(wrapper.querySelector('[data-test="keep"]')).not.toBeNull();
			expect(wrapper.textContent).toBe('');
		});

		it('should produce an empty wrapper when markup contains no <svg>', () => {
			const doc = makeDoc();
			const wrapper = buildQrReplacement(doc, '<div>no svg here</div>');
			expect(wrapper.tagName).toBe('P');
			expect(wrapper.children).toHaveLength(0);
		});
	});
});
