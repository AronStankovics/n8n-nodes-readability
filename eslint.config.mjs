import { configWithoutCloudSupport } from '@n8n/node-cli/eslint';
import n8nNodesBase from 'eslint-plugin-n8n-nodes-base';

// ESLint v10 removed the legacy `context.getFilename()` / `context.getSourceCode()`
// methods (and similar getters). `eslint-plugin-n8n-nodes-base` still uses them,
// so we wrap every rule's `create` with a Proxy that shims the old API on top of
// the new properties (`context.filename`, `context.sourceCode`, ...).
for (const rule of Object.values(n8nNodesBase.rules ?? {})) {
	const originalCreate = rule.create;
	if (typeof originalCreate !== 'function' || originalCreate.__eslintV10Shim) continue;
	const wrapped = function (context) {
		const shimmed = new Proxy(context, {
			get(target, prop, receiver) {
				switch (prop) {
					case 'getFilename':
						return () => target.filename;
					case 'getPhysicalFilename':
						return () => target.physicalFilename ?? target.filename;
					case 'getSourceCode':
						return () => target.sourceCode;
					case 'getCwd':
						return () => target.cwd;
					case 'getScope':
						return () => target.sourceCode.getScope(target.sourceCode.ast);
					case 'getAncestors':
						return () => target.sourceCode.getAncestors(target.sourceCode.ast);
					default:
						return Reflect.get(target, prop, receiver);
				}
			},
		});
		return originalCreate.call(this, shimmed);
	};
	wrapped.__eslintV10Shim = true;
	rule.create = wrapped;
}

const base = Array.isArray(configWithoutCloudSupport)
	? configWithoutCloudSupport
	: [configWithoutCloudSupport];

export default [
	...base,
	{ ignores: ['test/**', 'dist/**', 'coverage/**'] },
];
