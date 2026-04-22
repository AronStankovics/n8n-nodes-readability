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

const VIDEO_QR_CONCURRENCY_LIMIT = 4;

async function mapWithConcurrencyLimit<T, R>(
	items: readonly T[],
	limit: number,
	mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let nextIndex = 0;

	async function worker(): Promise<void> {
		while (true) {
			const currentIndex = nextIndex++;
			if (currentIndex >= items.length) return;
			results[currentIndex] = await mapper(items[currentIndex], currentIndex);
		}
	}

	const workerCount = Math.min(limit, items.length);
	await Promise.all(
		Array.from({ length: workerCount }, () => worker()),
	);

	return results;
}

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

	const jobs: Array<{ url: string | null; target: Element }> = [];
	for (const el of videoEls) {
		const target = outerVideoContainer(el);
		if (!target.parentNode) continue;
		jobs.push({ url: resolveVideoUrl(el), target });
	}

	const qrSvgs = await mapWithConcurrencyLimit(
		jobs,
		VIDEO_QR_CONCURRENCY_LIMIT,
		(job) =>
			mode === 'qr' && job.url
				? QRCode.toString(job.url, {
						type: 'svg',
						errorCorrectionLevel: 'M',
						margin: 1,
						width: 128,
					})
				: Promise.resolve<string | null>(null),
	);

	for (let i = 0; i < jobs.length; i++) {
		const { target } = jobs[i];
		if (!target.parentNode) continue;
		const qr = qrSvgs[i];
		if (qr === null) {
			target.remove();
		} else {
			target.parentNode.replaceChild(buildQrReplacement(doc, qr), target);
		}
	}
}
