export function unwrapImageTables(container: Element): void {
	for (const table of container.querySelectorAll('table')) {
		const imgs = table.querySelectorAll('img');
		if (imgs.length === 1) {
			table.parentNode?.replaceChild(imgs[0].cloneNode(true), table);
		}
	}
}
