/*
 * End-to-end tests against checked-in real-world-shaped HTML fixtures.
 * Offline: no network access; each test reads an HTML file and runs the
 * full Readability.execute() pipeline with realistic option combinations.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { Readability } from '../../nodes/Readability/Readability.node';
import { createMockExecuteFunctions } from '../mock-execute-functions';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

describe('test/integration/integration.test.ts', () => {
	describe('Wikipedia-style article', () => {
		it('should be marked readable and extract title + substantial content', async () => {
			const html = loadFixture('wikipedia.html');
			const json = await runHtml(html, {});
			expect(json.readable).toBe(true);
			expect(typeof json.title).toBe('string');
			expect(json.title).not.toBe('');
			expect(typeof json.content).toBe('string');
			expect((json.content as string).length).toBeGreaterThan(500);
			expect(typeof json.textContent).toBe('string');
			expect((json.textContent as string).length).toBeGreaterThan(500);
		});
	});

	describe('Newsletter with video + image tables', () => {
		it('should unwrap single-image tables and QR-replace videos', async () => {
			const html = loadFixture('substack.html');
			const json = await runHtml(html, {
				unwrapImageTables: true,
				videos: 'qr',
			});
			expect(json.readable).toBe(true);
			const content = json.content as string;
			// Either the lead single-image table was unwrapped, or readability
			// cleaned it out entirely — but we must not see a <table> wrapping
			// only the lead image.
			expect(content).not.toMatch(/<table[^>]*>\s*<tr[^>]*>\s*<td[^>]*>\s*<img[^>]*lead-image/);
			// Video placeholder must be gone; QR marker or video removal both acceptable.
			expect(content).not.toContain('<video');
			expect(content).not.toMatch(/<iframe[\s\S]*youtube/);
		});
	});

	describe('Generic blog post', () => {
		it('should strip links when removeLinks:"strip" is enabled', async () => {
			const html = loadFixture('generic-blog.html');
			const json = await runHtml(html, { removeLinks: 'strip' });
			expect(json.readable).toBe(true);
			const content = json.content as string;
			expect(content).not.toMatch(/<a\s/);
			expect(json.length as number).toBe((json.textContent as string).length);
		});
	});
});
