/*
 * Structural sanity tests for the INodeTypeDescription block.
 * Guards against accidental renames / removals of properties and options.
 */

import { expect } from 'chai';

import { Readability } from '../nodes/Readability/Readability.node';

function findProperty(node: Readability, name: string) {
	return node.description.properties.find((p) => p.name === name);
}

describe('nodes/Readability/Readability.node.ts', function () {
	describe('description', function () {
		const node = new Readability();
		const desc = node.description;

		it('should expose displayName, name, version, group, and usableAsTool', function () {
			expect(desc.displayName).to.equal('Readability');
			expect(desc.name).to.equal('readability');
			expect(desc.version).to.equal(1);
			expect(desc.group).to.deep.equal(['transform']);
			expect(desc.usableAsTool).to.equal(true);
		});

		it('should expose exactly the expected top-level properties', function () {
			const names = desc.properties.map((p) => p.name);
			expect(names).to.have.members([
				'inputSource',
				'url',
				'html',
				'baseUrl',
				'inputBinaryProperty',
				'options',
			]);
		});

		it('should offer url/html/binary as inputSource values', function () {
			const inputSource = findProperty(node, 'inputSource');
			expect(inputSource, 'inputSource missing').to.exist;
			const values = (inputSource!.options ?? []).map((o) => {
				const anyO = o as { value?: string };
				return anyO.value;
			});
			expect(values).to.have.members(['url', 'html', 'binary']);
		});

		it('should expose every documented option key on the options collection', function () {
			const options = findProperty(node, 'options');
			expect(options, 'options missing').to.exist;
			const keys = (options!.options ?? []).map((o) => {
				const anyO = o as { name?: string };
				return anyO.name;
			});
			expect(keys).to.have.members([
				'charThreshold',
				'debug',
				'keepClasses',
				'maxElemsToParse',
				'nbTopCandidates',
				'probablyReaderableOnly',
				'removeLinks',
				'timeoutMs',
				'unwrapImageTables',
				'userAgent',
				'videos',
			]);
		});

		it('should offer keep/unwrap/strip for removeLinks', function () {
			const options = findProperty(node, 'options')!.options ?? [];
			const removeLinks = options.find((o) => {
				const anyO = o as { name?: string };
				return anyO.name === 'removeLinks';
			}) as { options?: Array<{ value?: string }> } | undefined;
			const values = (removeLinks?.options ?? []).map((o) => o.value);
			expect(values).to.have.members(['keep', 'unwrap', 'strip']);
		});

		it('should offer keep/remove/qr for videos', function () {
			const options = findProperty(node, 'options')!.options ?? [];
			const videos = options.find((o) => {
				const anyO = o as { name?: string };
				return anyO.name === 'videos';
			}) as { options?: Array<{ value?: string }> } | undefined;
			const values = (videos?.options ?? []).map((o) => o.value);
			expect(values).to.have.members(['keep', 'remove', 'qr']);
		});
	});
});
