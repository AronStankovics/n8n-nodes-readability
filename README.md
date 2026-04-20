# n8n-nodes-readability

n8n community node that extracts the readable article (title, byline, main content, excerpt, etc.) from a URL or HTML, using [Mozilla Readability](https://github.com/mozilla/readability) — the same engine behind Firefox Reader View.

Useful for RSS pipelines, AI summarisation, newsletter digests, and any workflow where you want clean article text instead of raw HTML.

## Install

**Self-hosted n8n**
Settings → Community Nodes → **Install** → `n8n-nodes-readability`.

**n8n Cloud**
Community nodes on Cloud must go through n8n's verification process. See [Publish for verification](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/). Once published to npm and submitted, verified users can install it from the Cloud node panel.

## Node: Readability

**Input Source** — one of:

- `URL` — the node fetches the page over HTTP and parses it
- `HTML String` — pass raw HTML in as a string (from HTTP Request, Webhook, etc.)
- `Binary HTML` — parse an HTML file from a previous node's binary data

**Options**

| Option | Default | Description |
| --- | --- | --- |
| Char Threshold | 500 | Minimum length of the extracted article |
| Keep Classes | false | Preserve `class` attributes on the output HTML |
| Max Elements to Parse | 0 (no limit) | Hard cap on elements Readability processes |
| Number of Top Candidates | 5 | How many candidate roots Readability ranks |
| Probably Readable Only | false | Skip pages Readability thinks are unlikely articles |
| Debug | false | Readability debug logging to stderr |
| Request Timeout (ms) | 15000 | Only used for `URL` source |
| User Agent | `Mozilla/5.0 …` | Only used for `URL` source |

**Output** (one item per input, even for non-readable pages):

```json
{
  "readable": true,
  "url": "https://example.com/article",
  "title": "…",
  "byline": "…",
  "dir": "ltr",
  "lang": "en",
  "content": "<div>…cleaned HTML…</div>",
  "textContent": "…plain text…",
  "length": 12345,
  "excerpt": "…",
  "siteName": "…",
  "publishedTime": "2026-01-01T00:00:00Z"
}
```

If the page cannot be parsed as an article, the output is `{ "readable": false, "url": "…" }`.

## Develop

```bash
npm install
npm run dev    # runs tsc --watch inside a throwaway n8n
npm run build
npm run lint
```

## License

MIT
