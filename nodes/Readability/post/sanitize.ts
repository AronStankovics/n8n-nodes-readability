import createDOMPurify, { type DOMPurify, type WindowLike } from 'dompurify';

export function sanitize(container: Element, doc: Document): void {
	const window = doc.defaultView;
	if (!window) return;
	const purifier: DOMPurify = createDOMPurify(window as unknown as WindowLike);
	container.innerHTML = purifier.sanitize(container.innerHTML);
}
