import type { INodeProperties } from 'n8n-workflow';

export const DEFAULT_USER_AGENT =
	'Mozilla/5.0 (compatible; n8n-nodes-reader-view/0.1; +https://github.com/AronStankovics/n8n-nodes-readability)';
export const DEFAULT_TIMEOUT_MS = 15000;
export const DEFAULT_BINARY_PROPERTY = 'data';

export const properties: INodeProperties[] = [
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
];
