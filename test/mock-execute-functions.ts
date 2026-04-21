/*
 * Mock factory for n8n's IExecuteFunctions, covering the subset of methods
 * the Readability node actually calls. This replaces fetch-mock: the node
 * never reaches global fetch; all HTTP goes through this.helpers.httpRequest,
 * which n8n injects at runtime and we inject here.
 */

import type {
	IBinaryKeyData,
	IExecuteFunctions,
	IHttpRequestOptions,
	INode,
	INodeExecutionData,
} from 'n8n-workflow';

export type ParamMap = Record<string, unknown>;
export type ParamResolver = (name: string, itemIndex: number, fallback?: unknown) => unknown;

export interface MockOverrides {
	items?: INodeExecutionData[];
	params?: ParamMap | ParamResolver;
	httpRequest?: (opts: IHttpRequestOptions) => Promise<unknown>;
	getBinaryDataBuffer?: (itemIndex: number, propertyName: string) => Promise<Buffer>;
	continueOnFail?: boolean;
	node?: Partial<INode>;
}

export interface MockCallLog {
	httpRequest: IHttpRequestOptions[];
	getBinaryDataBuffer: Array<{ itemIndex: number; propertyName: string }>;
	getNodeParameter: Array<{ name: string; itemIndex: number; fallback: unknown }>;
}

export interface MockExecuteFunctions extends IExecuteFunctions {
	calls: MockCallLog;
}

function resolveParam(
	params: ParamMap | ParamResolver | undefined,
	name: string,
	itemIndex: number,
	fallback: unknown,
): unknown {
	if (typeof params === 'function') {
		return params(name, itemIndex, fallback);
	}
	if (params && Object.prototype.hasOwnProperty.call(params, name)) {
		return params[name];
	}
	return fallback;
}

export function createMockExecuteFunctions(overrides: MockOverrides = {}): MockExecuteFunctions {
	const calls: MockCallLog = {
		httpRequest: [],
		getBinaryDataBuffer: [],
		getNodeParameter: [],
	};

	const node: INode = {
		id: 'test-node',
		name: 'Readability',
		type: 'n8n-nodes-reader-view.readability',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
		...(overrides.node ?? {}),
	} as INode;

	const items: INodeExecutionData[] = overrides.items ?? [{ json: {}, binary: {} as IBinaryKeyData }];

	const mock = {
		getInputData(): INodeExecutionData[] {
			return items;
		},
		getNodeParameter(name: string, itemIndex: number, fallback?: unknown): unknown {
			calls.getNodeParameter.push({ name, itemIndex, fallback });
			return resolveParam(overrides.params, name, itemIndex, fallback);
		},
		continueOnFail(): boolean {
			return overrides.continueOnFail ?? false;
		},
		getNode(): INode {
			return node;
		},
		helpers: {
			async httpRequest(opts: IHttpRequestOptions): Promise<unknown> {
				calls.httpRequest.push(opts);
				if (!overrides.httpRequest) {
					throw new Error('httpRequest stub not provided');
				}
				return overrides.httpRequest(opts);
			},
			async getBinaryDataBuffer(itemIndex: number, propertyName: string): Promise<Buffer> {
				calls.getBinaryDataBuffer.push({ itemIndex, propertyName });
				if (!overrides.getBinaryDataBuffer) {
					throw new Error('getBinaryDataBuffer stub not provided');
				}
				return overrides.getBinaryDataBuffer(itemIndex, propertyName);
			},
		},
		calls,
	};

	return mock as unknown as MockExecuteFunctions;
}
