// Node 22 enables native --experimental-strip-types by default for `.ts`
// files, which loads them as ES modules and bypasses ts-node's CJS hook.
// Disable it so ts-node handles every spec file (proxyquire needs CJS
// `module.parent` to resolve the calling file). The flag does not exist
// on Node 20, so we only add it when running on 22+.
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);

module.exports = {
	extension: ['ts'],
	spec: ['test/*.test.ts'],
	require: ['ts-node/register', 'source-map-support/register'],
	'node-option': nodeMajor >= 22 ? ['no-experimental-strip-types'] : [],
	reporter: 'spec',
	timeout: 5000,
	recursive: false,
};
