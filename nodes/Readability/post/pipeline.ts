import { unwrapImageTables } from './images';
import { processLinks, stripTrackingParams, type LinkMode } from './links';
import { processVideos, type VideoMode } from './videos';

export interface PipelineOptions {
	unwrapImageTables?: boolean;
	videos?: VideoMode;
	removeLinks?: LinkMode;
	stripTrackingParams?: boolean;
}

export interface PipelineResult {
	content: string;
	textContent: string;
	length: number;
}

export function needsPostProcess(opts: PipelineOptions): boolean {
	return (
		opts.unwrapImageTables === true ||
		opts.stripTrackingParams === true ||
		(opts.videos !== undefined && opts.videos !== 'keep') ||
		(opts.removeLinks !== undefined && opts.removeLinks !== 'keep')
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
	if (opts.stripTrackingParams) stripTrackingParams(container);
	if (opts.removeLinks && opts.removeLinks !== 'keep') {
		processLinks(container, opts.removeLinks);
	}

	const text = container.textContent ?? '';
	return {
		content: container.innerHTML,
		textContent: text,
		length: text.length,
	};
}
