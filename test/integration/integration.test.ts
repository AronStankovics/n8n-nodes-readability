/*
 * End-to-end tests against checked-in real-world-shaped HTML fixtures.
 * Offline: no network access; each test reads an HTML file and runs the
 * full Readability.execute() pipeline with realistic option combinations.
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

import { Readability } from '../../nodes/Readability/Readability.node';
import { createMockExecuteFunctions } from '../mock-execute-functions';

function loadFixture(name: string): string {
	return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

async function runHtml(html: string, options: Record<string, unknown>, baseUrl = '') {
	const mock = createMockExecuteFunctions({
		params: { inputSource: 'html', html, baseUrl, options },
	});
	const result = await new Readability().execute.call(mock);
	return result[0][0].json as Record<string, unknown>;
}

describe('test/integration/integration.test.ts', function () {
	this.timeout(30000);

	describe('Wikipedia-style article', function () {
		it('should be marked readable and extract title + substantial content', async function () {
			const html = loadFixture('wikipedia.html');
			const json = await runHtml(html, {});
			expect(json.readable).to.equal(true);
			expect(json.title).to.be.a('string').and.not.equal('');
			expect(json.content).to.be.a('string');
			expect((json.content as string).length).to.be.greaterThan(500);
			expect(json.textContent).to.be.a('string');
			expect((json.textContent as string).length).to.be.greaterThan(500);
		});
	});

	describe('Newsletter with video + image tables', function () {
		it('should unwrap single-image tables and QR-replace videos', async function () {
			const html = loadFixture('substack.html');
			const json = await runHtml(html, {
				unwrapImageTables: true,
				videos: 'qr',
			});
			expect(json.readable).to.equal(true);
			const content = json.content as string;
			// Either the lead single-image table was unwrapped, or readability
			// cleaned it out entirely — but we must not see a <table> wrapping
			// only the lead image.
			expect(content).to.not.match(/<table[^>]*>\s*<tr[^>]*>\s*<td[^>]*>\s*<img[^>]*lead-image/);
			// Video placeholder must be gone; QR marker or video removal both acceptable.
			expect(content).to.not.include('<video');
			expect(content).to.not.match(/<iframe[\s\S]*youtube/);
		});
	});

	describe('Generic blog post', function () {
		it('should strip links when removeLinks:"strip" is enabled', async function () {
			const html = loadFixture('generic-blog.html');
			const json = await runHtml(html, { removeLinks: 'strip' });
			expect(json.readable).to.equal(true);
			const content = json.content as string;
			expect(content).to.not.match(/<a\s/);
			expect((json.length as number)).to.equal((json.textContent as string).length);
		});
	});
});
