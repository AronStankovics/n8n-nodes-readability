import type { IExecuteFunctions } from 'n8n-workflow';

export type InputSource = 'url' | 'html' | 'binary';

export interface LoadedDocument {
	html: string;
	// null when the caller did not provide a source URL (HTML/binary without baseUrl).
	// Consumers that need a concrete URL for DOM resolution should substitute 'about:blank'.
	url: string | null;
}

export interface LoaderDefaults {
	userAgent: string;
	timeoutMs: number;
	binaryProperty: string;
}

export interface LoaderRequestOptions {
	userAgent?: string;
	timeoutMs?: number;
}

export interface LoaderContext {
	ctx: IExecuteFunctions;
	itemIndex: number;
	requestOptions: LoaderRequestOptions;
	defaults: LoaderDefaults;
}

type Loader = (c: LoaderContext) => Promise<LoadedDocument>;

const loaders: Record<InputSource, Loader> = {
	async url({ ctx, itemIndex, requestOptions, defaults }) {
		const url = ctx.getNodeParameter('url', itemIndex) as string;
		const response = await ctx.helpers.httpRequest({
			method: 'GET',
			url,
			headers: {
				'User-Agent': requestOptions.userAgent ?? defaults.userAgent,
				Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
			},
			timeout: requestOptions.timeoutMs ?? defaults.timeoutMs,
			returnFullResponse: false,
		});
		const html = typeof response === 'string' ? response : String(response);
		return { html, url };
	},

	async html({ ctx, itemIndex }) {
		const html = ctx.getNodeParameter('html', itemIndex) as string;
		const baseUrl = ctx.getNodeParameter('baseUrl', itemIndex, '') as string;
		return { html, url: baseUrl || null };
	},

	async binary({ ctx, itemIndex, defaults }) {
		const property = ctx.getNodeParameter(
			'inputBinaryProperty',
			itemIndex,
			defaults.binaryProperty,
		) as string;
		const baseUrl = ctx.getNodeParameter('baseUrl', itemIndex, '') as string;
		const buffer = await ctx.helpers.getBinaryDataBuffer(itemIndex, property);
		return { html: buffer.toString('utf-8'), url: baseUrl || null };
	},
};

export async function loadDocument(
	source: InputSource,
	context: LoaderContext,
): Promise<LoadedDocument> {
	return loaders[source](context);
}
