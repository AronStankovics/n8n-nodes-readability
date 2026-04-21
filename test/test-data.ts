/*
 * Shared HTML fixtures for the Readability test suite.
 *
 * Snippets are kept small and deterministic. Article-shaped fixtures include
 * enough paragraph text to clear Mozilla Readability's default 500-character
 * threshold; shorter ones exist to exercise the null-article path.
 */

export function longParagraphs(n: number): string {
	const paragraph =
		'This is a sentence with enough words to exceed the character threshold that Mozilla Readability uses to decide whether a page is article-shaped. ' +
		'It repeats itself in a way that mimics prose so the parser treats the surrounding container as the main content of the page. ' +
		'Each paragraph is deliberately padded so that even a modest charThreshold still classifies the document as readable.';
	return Array(n).fill(`<p>${paragraph}</p>`).join('\n');
}

export const articleHtml = `<!DOCTYPE html>
<html lang="en">
<head><title>Test Article</title></head>
<body>
	<header><nav><a href="/home">Home</a></nav></header>
	<article>
		<h1>Test Article Title</h1>
		<p>By <span class="byline">Jane Doe</span></p>
		${longParagraphs(4)}
	</article>
	<footer>Footer noise</footer>
</body>
</html>`;

export const tinyHtml = `<!DOCTYPE html><html><head><title>T</title></head><body><p>short</p></body></html>`;

// Body is empty, so Mozilla Readability returns null from parse() — the only
// reliable way we have of exercising the "readable:false" fallback path.
export const emptyHtml = `<!DOCTYPE html><html><head><title>Empty</title></head><body></body></html>`;

export const notArticleHtml = `<!DOCTYPE html>
<html>
<head><title>Nav</title></head>
<body>
	<nav><a href="/a">a</a> <a href="/b">b</a></nav>
	<div>hi</div>
</body>
</html>`;

export const imageTableHtml = `<!DOCTYPE html>
<html>
<head><title>Image Table</title></head>
<body>
	<article>
		<h1>Newsletter</h1>
		${longParagraphs(2)}
		<table><tr><td><img src="https://example.com/image-inside-table.png" alt="wrapped"></td></tr></table>
		${longParagraphs(2)}
		<table>
			<tr><td><img src="https://example.com/a.png"></td><td><img src="https://example.com/b.png"></td></tr>
		</table>
		${longParagraphs(2)}
	</article>
</body>
</html>`;

export const videoHtml = `<!DOCTYPE html>
<html>
<head><title>Video Article</title></head>
<body>
	<article>
		<h1>Article With Videos</h1>
		${longParagraphs(2)}
		<p><video src="https://cdn.example.com/plain.mp4"></video></p>
		${longParagraphs(1)}
		<p><a href="https://youtu.be/abc123"><img data-component-name="VideoPlaceholder" src="https://img.youtube.com/vi/abc123/0.jpg"></a></p>
		${longParagraphs(1)}
		<p><iframe src="https://www.youtube.com/embed/xyz789"></iframe></p>
		${longParagraphs(2)}
	</article>
</body>
</html>`;

export const linksHtml = `<!DOCTYPE html>
<html>
<head><title>Links</title></head>
<body>
	<article>
		<h1>Links Article</h1>
		${longParagraphs(2)}
		<p>See <a href="https://example.com/one">one</a> and <a href="https://example.com/two">two</a> and also <a href="https://example.com/three">three</a>.</p>
		${longParagraphs(2)}
	</article>
</body>
</html>`;

export const userAgentProbeHtml = articleHtml;

export const fakeQrSvg =
	'<svg xmlns="http://www.w3.org/2000/svg" data-test="qr" width="128" height="128"><rect width="128" height="128"/></svg>';
