import QRCode from 'qrcode';

export type VideoMode = 'keep' | 'remove' | 'qr';

const VIDEO_SELECTOR = [
	'video',
	'iframe[src*="youtube.com"]',
	'iframe[src*="youtube-nocookie.com"]',
	'iframe[src*="vimeo.com"]',
	'iframe[src*="loom.com"]',
	'iframe[src*="wistia.net"]',
	'img[data-component-name^="Video"]',
	'img[data-testid^="video-"]',
].join(',');

export function resolveVideoUrl(el: Element): string | null {
	let anchor: Element | null = el.parentElement;
	while (anchor && anchor.tagName !== 'A') anchor = anchor.parentElement;
	const anchorHref = anchor?.getAttribute('href');
	if (anchorHref) return anchorHref;

	if (el.tagName === 'VIDEO') {
		const direct = el.getAttribute('src');
		if (direct) return direct;
		return el.querySelector('source')?.getAttribute('src') ?? null;
	}
	return el.getAttribute('src');
}

export function outerVideoContainer(el: Element): Element {
	let node: Element = el;
	if (node.parentElement?.tagName === 'A') node = node.parentElement;
	const p = node.parentElement;
	if (
		p &&
		p.tagName === 'P' &&
		p.children.length === 1 &&
		(p.textContent ?? '').trim() === (node.textContent ?? '').trim()
	) {
		node = p;
	}
	return node;
}

export function buildQrReplacement(doc: Document, svgMarkup: string): Element {
	const wrapper = doc.createElement('p');
	wrapper.setAttribute('class', 'qr-for-video');
	wrapper.setAttribute('style', 'text-align: center');
	const temp = doc.createElement('div');
	temp.innerHTML = svgMarkup;
	const svg = temp.querySelector('svg');
	if (svg) wrapper.appendChild(svg);
	return wrapper;
}

export async function processVideos(
	container: Element,
	doc: Document,
	mode: 'remove' | 'qr',
): Promise<void> {
	const videoEls = container.querySelectorAll(VIDEO_SELECTOR);
	for (const el of videoEls) {
		const url = resolveVideoUrl(el);
		const target = outerVideoContainer(el);
		if (!target.parentNode) continue;
		if (mode === 'remove' || !url) {
			target.remove();
		} else {
			const qrSvg = await QRCode.toString(url, {
				type: 'svg',
				errorCorrectionLevel: 'M',
				margin: 1,
				width: 128,
			});
			target.parentNode.replaceChild(buildQrReplacement(doc, qrSvg), target);
		}
	}
}
