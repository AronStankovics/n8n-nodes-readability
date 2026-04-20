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

type InputSource = 'url' | 'html' | 'binary';

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
				default: 'data',
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
						displayName: 'Request Timeout (Ms)',
						name: 'timeoutMs',
						type: 'number',
						default: 15000,
						description: 'HTTP timeout when fetching a URL',
					},
					{
						displayName: 'User Agent',
						name: 'userAgent',
						type: 'string',
						default:
							'Mozilla/5.0 (compatible; n8n-nodes-readability/0.1; +https://github.com/AronStankovics/n8n-nodes-readability)',
						description: 'User-Agent header sent when fetching a URL',
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
					timeoutMs?: number;
					userAgent?: string;
				};

				let html: string;
				let documentUrl: string;

				if (inputSource === 'url') {
					documentUrl = this.getNodeParameter('url', itemIndex) as string;
					const response = await this.helpers.httpRequest({
						method: 'GET',
						url: documentUrl,
						headers: {
							'User-Agent':
								options.userAgent ??
								'Mozilla/5.0 (compatible; n8n-nodes-readability/0.1)',
							Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
						},
						timeout: options.timeoutMs ?? 15000,
						returnFullResponse: false,
					});
					html = typeof response === 'string' ? response : String(response);
				} else {
					documentUrl =
						(this.getNodeParameter('baseUrl', itemIndex, '') as string) || 'about:blank';
					if (inputSource === 'html') {
						html = this.getNodeParameter('html', itemIndex) as string;
					} else {
						const inputBinaryProperty = this.getNodeParameter(
							'inputBinaryProperty',
							itemIndex,
						) as string;
						const buffer = await this.helpers.getBinaryDataBuffer(
							itemIndex,
							inputBinaryProperty,
						);
						html = buffer.toString('utf-8');
					}
				}

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
