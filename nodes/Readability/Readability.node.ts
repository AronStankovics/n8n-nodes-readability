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
		properties: [
			{
				displayName: 'Input Source',
				name: 'inputSource',
				type: 'options',
				noDataExpression: true,
				default: 'url',
				options: [
					{
						name: 'URL',
						value: 'url',
						description: 'Fetch the given URL and parse it',
					},
					{
						name: 'HTML String',
						value: 'html',
						description: 'Parse raw HTML passed as a string',
					},
					{
						name: 'Binary HTML',
						value: 'binary',
						description: "Parse an HTML file from a previous node's binary data",
					},
				],
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://example.com/article',
				displayOptions: { show: { inputSource: ['url'] } },
			},
			{
				displayName: 'HTML',
				name: 'html',
				type: 'string',
				typeOptions: { rows: 8 },
				default: '',
				required: true,
				placeholder: '<html>…</html>',
				displayOptions: { show: { inputSource: ['html'] } },
			},
			{
				displayName: 'Base URL',
				name: 'baseUrl',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/article',
				description: 'Used to resolve relative links inside the HTML. Optional.',
				displayOptions: { show: { inputSource: ['html', 'binary'] } },
			},
			{
				displayName: 'Input Binary Property',
				name: 'inputBinaryProperty',
				type: 'string',
				default: DEFAULT_BINARY_PROPERTY,
				required: true,
				description: 'Name of the binary property that holds the HTML',
				displayOptions: { show: { inputSource: ['binary'] } },
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Char Threshold',
						name: 'charThreshold',
						type: 'number',
						default: 500,
						description:
							'Minimum number of characters an article must have to be returned as readable',
					},
					{
						displayName: 'Debug',
						name: 'debug',
						type: 'boolean',
						default: false,
						description: 'Whether to enable Readability debug logging on stderr',
					},
					{
						displayName: 'Keep Classes',
						name: 'keepClasses',
						type: 'boolean',
						default: false,
						description: 'Whether to preserve class attributes on the extracted HTML',
					},
					{
						displayName: 'Max Elements to Parse',
						name: 'maxElemsToParse',
						type: 'number',
						default: 0,
						description:
							'Maximum number of elements Readability will process. 0 means no limit.',
					},
					{
						displayName: 'Number of Top Candidates',
						name: 'nbTopCandidates',
						type: 'number',
						default: 5,
						description: 'Number of top candidates Readability considers when picking the article root',
					},
					{
						displayName: 'Probably Readable Only',
						name: 'probablyReaderableOnly',
						type: 'boolean',
						default: false,
						description:
							'Whether to skip pages that isProbablyReaderable considers unlikely to be articles',
					},
					{
						displayName: 'Remove Links',
						name: 'removeLinks',
						type: 'options',
						default: 'keep',
						description:
							'Post-process the extracted HTML to strip anchor tags. Useful for EPUB/Kindle output where links are distracting.',
						options: [
							{ name: 'Keep', value: 'keep', description: 'Leave anchors untouched' },
							{
								name: 'Unwrap',
								value: 'unwrap',
								description: 'Remove <a> tags but keep their text and child content',
							},
							{
								name: 'Strip',
								value: 'strip',
								description: 'Remove <a> tags along with their content',
							},
						],
					},
					{
						displayName: 'Request Timeout (Ms)',
						name: 'timeoutMs',
						type: 'number',
						default: DEFAULT_TIMEOUT_MS,
						description: 'HTTP timeout when fetching a URL',
					},
					{
						displayName: 'Unwrap Image Tables',
						name: 'unwrapImageTables',
						type: 'boolean',
						default: false,
						description:
							'Whether to replace any &lt;table&gt; containing exactly one &lt;img&gt; with just the image. Useful for Substack and other newsletter emails that wrap images in layout tables.',
					},
					{
						displayName: 'User Agent',
						name: 'userAgent',
						type: 'string',
						default: DEFAULT_USER_AGENT,
						description: 'User-Agent header sent when fetching a URL',
					},
					{
						displayName: 'Videos',
						name: 'videos',
						type: 'options',
						default: 'keep',
						description:
							'How to handle video elements (&lt;video&gt;, known video iframes, and newsletter video preview images)',
						options: [
							{ name: 'Keep', value: 'keep', description: 'Leave video elements untouched' },
							{
								name: 'Remove',
								value: 'remove',
								description: 'Delete video elements (and enclosing anchor/paragraph if they contain nothing else)',
							},
							{
								name: 'Generate QR Code',
								value: 'qr',
								description: 'Replace the video element with an inline SVG QR code of the video URL — useful for Kindle readers',
							},
						],
					},
				],
			},
		],
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

				const dom = new JSDOM(html, { url: documentUrl, virtualConsole });
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
