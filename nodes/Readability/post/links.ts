export type LinkMode = 'keep' | 'unwrap' | 'strip';

export function processLinks(container: Element, mode: 'unwrap' | 'strip'): void {
	for (const a of container.querySelectorAll('a')) {
		if (mode === 'unwrap') {
			while (a.firstChild) a.parentNode?.insertBefore(a.firstChild, a);
		}
		a.remove();
	}
}
