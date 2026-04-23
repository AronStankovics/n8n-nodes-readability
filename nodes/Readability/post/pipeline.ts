import { unwrapImageTables } from './images';
import { processLinks, type LinkMode } from './links';
import { sanitize } from './sanitize';
import { processVideos, type VideoMode } from './videos';

export interface PipelineOptions {
	unwrapImageTables?: boolean;
	videos?: VideoMode;
	removeLinks?: LinkMode;
	sanitize?: boolean;
}

export interface PipelineResult {
	content: string;
	textContent: string;
	length: number;
}

export function needsPostProcess(opts: PipelineOptions): boolean {
	return (
		opts.unwrapImageTables === true ||
		(opts.videos !== undefined && opts.videos !== 'keep') ||
		(opts.removeLinks !== undefined && opts.removeLinks !== 'keep') ||
		opts.sanitize === true
	);
}

export async function runPostProcess(
	content: string,
	doc: Document,
	opts: PipelineOptions,
): Promise<PipelineResult> {
	const container = doc.createElement('div');
	container.innerHTML = content;

	if (opts.unwrapImageTables) unwrapImageTables(container);
	if (opts.videos && opts.videos !== 'keep') {
		await processVideos(container, doc, opts.videos);
	}
	if (opts.removeLinks && opts.removeLinks !== 'keep') {
		processLinks(container, opts.removeLinks);
	}
	if (opts.sanitize) sanitize(container, doc);

	const text = container.textContent ?? '';
	return {
		content: container.innerHTML,
		textContent: text,
		length: text.length,
	};
}
