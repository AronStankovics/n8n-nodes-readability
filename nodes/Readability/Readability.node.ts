import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { Readability as ReadabilityParser, isProbablyReaderable } from '@mozilla/readability';
import { JSDOM, VirtualConsole } from 'jsdom';

import { needsPostProcess, runPostProcess } from './post/pipeline';
import { properties } from './properties';
import { loadDocument, type InputSource } from './source/load';

const DEFAULT_USER_AGENT =
	'Mozilla/5.0 (compatible; n8n-nodes-reader-view/0.1; +https://github.com/AronStankovics/n8n-nodes-readability)';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_BINARY_PROPERTY = 'data';

interface ParsedArticle {
	title: string | null;
	byline: string | null;
	dir: string | null;
	lang: string | null;
	content: string | null;
	textContent: string | null;
	length: number | null;
	excerpt: string | null;
	siteName: string | null;
	publishedTime: string | null;
}

export class Readability implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Readability',
		name: 'readability',
		icon: 'file:readability.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["inputSource"]}}',
		description:
			'Extract the readable article (title, byline, main content) from a URL or HTML using Mozilla Readability',
		defaults: {
			name: 'Readability',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const inputSource = this.getNodeParameter('inputSource', itemIndex) as InputSource;
				const options = this.getNodeParameter('options', itemIndex, {}) as {
					charThreshold?: number;
					keepClasses?: boolean;
					debug?: boolean;
					maxElemsToParse?: number;
					nbTopCandidates?: number;
					probablyReaderableOnly?: boolean;
					removeLinks?: 'keep' | 'unwrap' | 'strip';
					unwrapImageTables?: boolean;
					timeoutMs?: number;
					userAgent?: string;
					videos?: 'keep' | 'remove' | 'qr';
				};

				const { html, url: documentUrl } = await loadDocument(inputSource, {
					ctx: this,
					itemIndex,
					requestOptions: { userAgent: options.userAgent, timeoutMs: options.timeoutMs },
					defaults: {
						userAgent: DEFAULT_USER_AGENT,
						timeoutMs: DEFAULT_TIMEOUT_MS,
						binaryProperty: DEFAULT_BINARY_PROPERTY,
					},
				});

				const virtualConsole = new VirtualConsole();
				// Silence jsdom CSS/script noise; we only need the parsed DOM.
				virtualConsole.on('error', () => undefined);
				virtualConsole.on('jsdomError', () => undefined);

				const dom = new JSDOM(html, { url: documentUrl ?? 'about:blank', virtualConsole });
				const doc = dom.window.document;

				if (options.probablyReaderableOnly && !isProbablyReaderable(doc)) {
					returnData.push({
						json: { readable: false, url: documentUrl },
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				const parserOptions: ConstructorParameters<typeof ReadabilityParser>[1] = {};
				if (options.charThreshold !== undefined) parserOptions.charThreshold = options.charThreshold;
				if (options.keepClasses !== undefined) parserOptions.keepClasses = options.keepClasses;
				if (options.debug !== undefined) parserOptions.debug = options.debug;
				if (options.maxElemsToParse && options.maxElemsToParse > 0) {
					parserOptions.maxElemsToParse = options.maxElemsToParse;
				}
				if (options.nbTopCandidates !== undefined) {
					parserOptions.nbTopCandidates = options.nbTopCandidates;
				}

				const reader = new ReadabilityParser(doc, parserOptions);
				const article = reader.parse() as ParsedArticle | null;

				if (!article) {
					returnData.push({
						json: { readable: false, url: documentUrl },
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				if (needsPostProcess(options) && article.content) {
					const result = await runPostProcess(article.content, doc, {
						unwrapImageTables: options.unwrapImageTables,
						videos: options.videos,
						removeLinks: options.removeLinks,
					});
					article.content = result.content;
					article.textContent = result.textContent;
					article.length = result.length;
				}

				const json: IDataObject = {
					readable: true,
					url: documentUrl,
					title: article.title ?? null,
					byline: article.byline ?? null,
					dir: article.dir ?? null,
					lang: article.lang ?? null,
					content: article.content ?? null,
					textContent: article.textContent ?? null,
					length: article.length ?? null,
					excerpt: article.excerpt ?? null,
					siteName: article.siteName ?? null,
					publishedTime: article.publishedTime ?? null,
				};

				returnData.push({ json, pairedItem: { item: itemIndex } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				if (error instanceof NodeOperationError) throw error;
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
