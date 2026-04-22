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
