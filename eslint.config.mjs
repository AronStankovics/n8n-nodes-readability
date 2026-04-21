import { configWithoutCloudSupport } from '@n8n/node-cli/eslint';

const base = Array.isArray(configWithoutCloudSupport)
	? configWithoutCloudSupport
	: [configWithoutCloudSupport];

export default [
	...base,
	{ ignores: ['test/**', 'dist/**', 'coverage/**'] },
];
