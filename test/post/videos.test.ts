/*
 * Unit tests for nodes/Readability/post/videos.ts — the three DOM helpers
 * plus the processVideos pipeline stage. QRCode is mocked with a
 * deterministic stub so tests are fast and hermetic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

const qrState = vi.hoisted(() => ({
	callLog: [] as string[],
}));

vi.mock('qrcode', () => {
	const toString = async (url: string) => {
		qrState.callLog.push(url);
		return `<svg xmlns="http://www.w3.org/2000/svg" data-url="${url}"><rect/></svg>`;
	};
	return { default: { toString }, toString };
});

import {
	buildQrReplacement,
	outerVideoContainer,
	processVideos,
	resolveVideoUrl,
} from '../../nodes/Readability/post/videos';

function makeDoc(bodyHtml: string = ''): Document {
	return new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`).window.document;
}

function makeContainer(innerHtml: string): { container: HTMLElement; doc: Document } {
	const doc = makeDoc();
	const container = doc.createElement('div');
	container.innerHTML = innerHtml;
	doc.body.appendChild(container);
	return { container, doc };
}

beforeEach(() => {
	qrState.callLog = [];
});

describe('nodes/Readability/post/videos.ts', () => {
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

		it('should return null for non-video elements that have no src and no anchor', () => {
			const doc = makeDoc('<img data-component-name="Video">');
			const img = doc.querySelector('img') as Element;
			expect(resolveVideoUrl(img)).toBeNull();
		});
	});

	describe('#outerVideoContainer(el)', () => {
		it('should return the element itself when parent is neither <a> nor a sole-child <p>', () => {
			const doc = makeDoc('<div><video src="https://cdn/v.mp4"></video></div>');
			const video = doc.querySelector('video') as Element;
			expect(outerVideoContainer(video)).toBe(video);
		});

		it('should expand to the anchor when parent is an <a>', () => {
			const doc = makeDoc(
				'<div><a href="https://ex.com/x"><video src="https://cdn/v.mp4"></video></a></div>',
			);
			const video = doc.querySelector('video') as Element;
			const anchor = doc.querySelector('a') as Element;
			expect(outerVideoContainer(video)).toBe(anchor);
		});

		it('should expand through <a> and a sole-child <p> when text content matches', () => {
			const doc = makeDoc(
				'<p><a href="https://ex.com/x"><video src="https://cdn/v.mp4"></video></a></p>',
			);
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

		it('should expand to <p> even when video is directly inside without an anchor', () => {
			const doc = makeDoc('<p><video src="https://cdn/v.mp4"></video></p>');
			const video = doc.querySelector('video') as Element;
			const paragraph = doc.querySelector('p') as Element;
			expect(outerVideoContainer(video)).toBe(paragraph);
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

	describe('#processVideos(container, doc, mode)', () => {
		describe('mode=remove', () => {
			it('should delete <video> elements', async () => {
				const { container, doc } = makeContainer(
					'<p>before</p><video src="https://cdn/x.mp4"></video><p>after</p>',
				);
				await processVideos(container, doc, 'remove');
				expect(container.querySelector('video')).toBeNull();
				expect(container.textContent).toContain('before');
				expect(container.textContent).toContain('after');
			});

			it('should delete known-host iframes', async () => {
				const { container, doc } = makeContainer(
					'<iframe src="https://www.youtube.com/embed/a"></iframe>' +
						'<iframe src="https://player.vimeo.com/video/b" class="vimeo"></iframe>' +
						'<iframe src="https://fast.wistia.net/embed/c"></iframe>' +
						'<iframe src="https://www.loom.com/embed/d"></iframe>' +
						'<iframe src="https://unknown.example.com/e"></iframe>',
				);
				// Only YouTube, Wistia, Loom match the hard-coded selector; the vimeo.com match is on src substring.
				await processVideos(container, doc, 'remove');
				const remaining = Array.from(container.querySelectorAll('iframe')).map((f) =>
					f.getAttribute('src'),
				);
				expect(remaining).toEqual(['https://unknown.example.com/e']);
			});

			it('should delete Substack-style video placeholder imgs', async () => {
				const { container, doc } = makeContainer(
					'<img data-component-name="VideoPlaceholder" src="https://thumb/a.jpg">' +
						'<img data-testid="video-player" src="https://thumb/b.jpg">' +
						'<img src="https://thumb/normal.jpg">',
				);
				await processVideos(container, doc, 'remove');
				const remaining = Array.from(container.querySelectorAll('img')).map((i) =>
					i.getAttribute('src'),
				);
				expect(remaining).toEqual(['https://thumb/normal.jpg']);
			});

			it('should not call QRCode.toString', async () => {
				const { container, doc } = makeContainer('<video src="https://cdn/x.mp4"></video>');
				await processVideos(container, doc, 'remove');
				expect(qrState.callLog).toEqual([]);
			});

			it('should remove the enclosing anchor and sole-child <p>', async () => {
				const { container, doc } = makeContainer(
					'<p><a href="https://ex.com/x"><video src="https://cdn/v.mp4"></video></a></p>',
				);
				await processVideos(container, doc, 'remove');
				expect(container.querySelector('p')).toBeNull();
				expect(container.querySelector('a')).toBeNull();
				expect(container.querySelector('video')).toBeNull();
			});
		});

		describe('mode=qr', () => {
			it('should replace a video with a QR wrapper using the video src', async () => {
				const { container, doc } = makeContainer(
					'<video src="https://cdn/x.mp4"></video>',
				);
				await processVideos(container, doc, 'qr');
				expect(qrState.callLog).toEqual(['https://cdn/x.mp4']);
				expect(container.querySelector('video')).toBeNull();
				const wrapper = container.querySelector('p.qr-for-video');
				expect(wrapper).not.toBeNull();
				expect(wrapper!.querySelector('svg[data-url="https://cdn/x.mp4"]')).not.toBeNull();
			});

			it('should prefer the enclosing anchor href over element src', async () => {
				const { container, doc } = makeContainer(
					'<a href="https://youtu.be/real"><img data-component-name="VideoPlaceholder" src="https://thumb/t.jpg"></a>',
				);
				await processVideos(container, doc, 'qr');
				expect(qrState.callLog).toEqual(['https://youtu.be/real']);
			});

			it('should fall back to removing the element when no URL can be resolved', async () => {
				const { container, doc } = makeContainer('<video></video><p>keep</p>');
				await processVideos(container, doc, 'qr');
				expect(container.querySelector('video')).toBeNull();
				expect(container.querySelector('p.qr-for-video')).toBeNull();
				expect(qrState.callLog).toEqual([]);
				expect(container.textContent).toContain('keep');
			});

			it('should process multiple videos and generate one QR per video', async () => {
				const { container, doc } = makeContainer(
					'<video src="https://cdn/a.mp4"></video>' +
						'<iframe src="https://www.youtube.com/embed/b"></iframe>' +
						'<video src="https://cdn/c.mp4"></video>',
				);
				await processVideos(container, doc, 'qr');
				expect(qrState.callLog.sort()).toEqual(
					[
						'https://cdn/a.mp4',
						'https://www.youtube.com/embed/b',
						'https://cdn/c.mp4',
					].sort(),
				);
				expect(container.querySelectorAll('p.qr-for-video')).toHaveLength(3);
			});

			it('should run QR generations concurrently, not serially', async () => {
				// Replace the qrcode mock with a slow one to observe concurrency.
				const { container, doc } = makeContainer(
					'<video src="https://cdn/a.mp4"></video>' +
						'<video src="https://cdn/b.mp4"></video>' +
						'<video src="https://cdn/c.mp4"></video>',
				);
				const mod = await import('qrcode');
				const originalToString = mod.default.toString;
				let inFlight = 0;
				let peakInFlight = 0;
				mod.default.toString = (async (url: string) => {
					inFlight++;
					peakInFlight = Math.max(peakInFlight, inFlight);
					await new Promise((r) => setTimeout(r, 20));
					inFlight--;
					return `<svg data-url="${url}"></svg>`;
				}) as typeof mod.default.toString;
				try {
					await processVideos(container, doc, 'qr');
					expect(peakInFlight).toBe(3);
				} finally {
					mod.default.toString = originalToString;
				}
			});
		});

		it('should do nothing when the container has no matching elements', async () => {
			const { container, doc } = makeContainer('<p>plain prose</p><img src="photo.jpg">');
			const before = container.innerHTML;
			await processVideos(container, doc, 'remove');
			expect(container.innerHTML).toBe(before);
		});
	});
});
