module.exports = {
	extension: ['ts'],
	spec: ['test/*.test.ts'],
	require: ['ts-node/register', 'source-map-support/register'],
	'node-option': ['no-experimental-strip-types'],
	reporter: 'spec',
	timeout: 5000,
	recursive: false,
};
