# Integration test fixtures

These are small real-world-shaped HTML files used by `test/integration/integration.test.ts`.
Each is checked in so the integration suite runs entirely offline — no network required.

To add a new fixture:

1. Save an article page's rendered HTML into this directory.
   Keep it under ~200 KB; trim inline scripts and giant CSS blocks if needed.
2. Add a test case to `test/integration/integration.test.ts` that loads the
   file with `fs.readFileSync` and asserts on the expected Readability output
   shape.

The shipped stand-ins are deliberately synthetic-but-realistic so the suite
passes on day one without relying on any specific external site.
