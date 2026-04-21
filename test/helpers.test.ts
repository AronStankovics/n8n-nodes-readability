/*
 * Unit tests for the three exported helper functions in Readability.node.ts.
 */

import { expect } from 'chai';
import { JSDOM } from 'jsdom';

import {
	buildQrReplacement,
	outerVideoContainer,
	resolveVideoUrl,
} from '../nodes/Readability/Readability.node';

function makeDoc(bodyHtml: string = ''): Document {
	return new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`).window.document;
}

describe('nodes/Readability/Readability.node.ts', function () {
	describe('#resolveVideoUrl(el)', function () {
		it('should return the href of the enclosing anchor when present', function () {
			const doc = makeDoc(
				'<a href="https://example.com/watch"><img data-component-name="VideoPlaceholder" src="https://thumb.example.com/t.jpg"></a>',
			);
			const el = doc.querySelector('img') as Element;
			expect(resolveVideoUrl(el)).to.equal('https://example.com/watch');
		});

		it('should prefer the nearest ancestor anchor and ignore siblings', function () {
			const doc = makeDoc(
				'<a href="https://sibling.example.com/x">sibling</a><div><a href="https://ancestor.example.com/y"><video src="https://cdn.example.com/v.mp4"></video></a></div>',
			);
			const video = doc.querySelector('video') as Element;
			expect(resolveVideoUrl(video)).to.equal('https://ancestor.example.com/y');
		});

		it('should return the <video> src attribute when no anchor is present', function () {
			const doc = makeDoc('<video src="https://cdn.example.com/direct.mp4"></video>');
			const video = doc.querySelector('video') as Element;
			expect(resolveVideoUrl(video)).to.equal('https://cdn.example.com/direct.mp4');
		});

		it('should fall back to the first <source> child src when <video> has no src', function () {
			const doc = makeDoc(
				'<video><source src="https://cdn.example.com/source.mp4" type="video/mp4"><source src="https://cdn.example.com/second.mp4"></video>',
			);
			const video = doc.querySelector('video') as Element;
			expect(resolveVideoUrl(video)).to.equal('https://cdn.example.com/source.mp4');
		});

		it('should return null when <video> has neither src nor source children', function () {
			const doc = makeDoc('<video></video>');
			const video = doc.querySelector('video') as Element;
			expect(resolveVideoUrl(video)).to.equal(null);
		});

		it('should return the src attribute for non-video elements (iframe) when no anchor', function () {
			const doc = makeDoc('<iframe src="https://www.youtube.com/embed/abc"></iframe>');
			const iframe = doc.querySelector('iframe') as Element;
			expect(resolveVideoUrl(iframe)).to.equal('https://www.youtube.com/embed/abc');
		});

		it('should return the src attribute for img elements when no anchor', function () {
			const doc = makeDoc('<img data-component-name="Video" src="https://thumb/x.jpg">');
			const img = doc.querySelector('img') as Element;
			expect(resolveVideoUrl(img)).to.equal('https://thumb/x.jpg');
		});
	});

	describe('#outerVideoContainer(el)', function () {
		it('should return the element itself when parent is neither <a> nor a sole-child <p>', function () {
			const doc = makeDoc('<div><video src="https://cdn/v.mp4"></video></div>');
			const video = doc.querySelector('video') as Element;
			expect(outerVideoContainer(video)).to.equal(video);
		});

		it('should expand to the anchor when parent is an <a>', function () {
			const doc = makeDoc('<div><a href="https://ex.com/x"><video src="https://cdn/v.mp4"></video></a></div>');
			const video = doc.querySelector('video') as Element;
			const anchor = doc.querySelector('a') as Element;
			expect(outerVideoContainer(video)).to.equal(anchor);
		});

		it('should expand through <a> and a sole-child <p> when text content matches', function () {
			const doc = makeDoc('<p><a href="https://ex.com/x"><video src="https://cdn/v.mp4"></video></a></p>');
			const video = doc.querySelector('video') as Element;
			const paragraph = doc.querySelector('p') as Element;
			expect(outerVideoContainer(video)).to.equal(paragraph);
		});

		it('should NOT expand to <p> when it has additional children', function () {
			const doc = makeDoc('<p><video src="https://cdn/v.mp4"></video><span>extra</span></p>');
			const video = doc.querySelector('video') as Element;
			expect(outerVideoContainer(video)).to.equal(video);
		});

		it('should NOT expand to <p> when paragraph has surrounding text siblings', function () {
			const doc = makeDoc('<p>prefix <video src="https://cdn/v.mp4"></video></p>');
			const video = doc.querySelector('video') as Element;
			// The <p> has one element child (the video), but text content differs
			// because of the "prefix " text node — so it should not expand.
			expect(outerVideoContainer(video)).to.equal(video);
		});
	});

	describe('#buildQrReplacement(doc, svgMarkup)', function () {
		it('should wrap the SVG in a <p class="qr-for-video" style="text-align: center">', function () {
			const doc = makeDoc();
			const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
			const wrapper = buildQrReplacement(doc, svg);
			expect(wrapper.tagName).to.equal('P');
			expect(wrapper.getAttribute('class')).to.equal('qr-for-video');
			expect(wrapper.getAttribute('style')).to.equal('text-align: center');
			expect(wrapper.querySelector('svg')).to.not.equal(null);
		});

		it('should strip non-svg content from the input markup', function () {
			const doc = makeDoc();
			const wrapper = buildQrReplacement(
				doc,
				'<div>junk</div><svg xmlns="http://www.w3.org/2000/svg"><rect data-test="keep"/></svg><span>after</span>',
			);
			expect(wrapper.children.length).to.equal(1);
			expect(wrapper.children[0].tagName.toLowerCase()).to.equal('svg');
			expect(wrapper.querySelector('[data-test="keep"]')).to.not.equal(null);
			expect(wrapper.textContent).to.equal('');
		});

		it('should produce an empty wrapper when markup contains no <svg>', function () {
			const doc = makeDoc();
			const wrapper = buildQrReplacement(doc, '<div>no svg here</div>');
			expect(wrapper.tagName).to.equal('P');
			expect(wrapper.children.length).to.equal(0);
		});
	});
});
