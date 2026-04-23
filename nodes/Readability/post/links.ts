export type LinkMode = 'keep' | 'unwrap' | 'strip';

export function processLinks(container: Element, mode: 'unwrap' | 'strip'): void {
	for (const a of container.querySelectorAll('a')) {
		if (mode === 'unwrap') {
			while (a.firstChild) a.parentNode?.insertBefore(a.firstChild, a);
		}
		a.remove();
	}
}

const TRACKING_PARAM_PREFIXES = ['utm_'];

const TRACKING_PARAM_NAMES = new Set([
	// Facebook
	'fbclid',
	// Google Ads / Analytics
	'gclid',
	'gclsrc',
	'dclid',
	'gbraid',
	'wbraid',
	// Microsoft / Bing
	'msclkid',
	// Yandex
	'yclid',
	// Instagram
	'igshid',
	// Mailchimp
	'mc_cid',
	'mc_eid',
	// Marketo
	'mkt_tok',
	// HubSpot
	'_hsenc',
	'_hsmi',
	'__hssc',
	'__hstc',
	'__hsfp',
	'hsCtaTracking',
	// Vero
	'vero_id',
	'vero_conv',
	// Misc analytics
	'_openstat',
	'wickedid',
	// Omeda
	'oly_anon_id',
	'oly_enc_id',
	// Adobe / Omniture
	's_cid',
	'cmpid',
	// Twitter / X share refs
	'ref_src',
	'ref_url',
	// Matomo / Piwik
	'pk_campaign',
	'pk_kwd',
	'pk_keyword',
	'piwik_campaign',
	'piwik_kwd',
	'piwik_keyword',
]);

export function isTrackingParam(name: string): boolean {
	if (TRACKING_PARAM_NAMES.has(name)) return true;
	for (const prefix of TRACKING_PARAM_PREFIXES) {
		if (name.startsWith(prefix)) return true;
	}
	return false;
}

export function stripTrackingFromUrl(url: string): string {
	const queryIdx = url.indexOf('?');
	if (queryIdx < 0) return url;

	const beforeQuery = url.slice(0, queryIdx);
	const afterQuery = url.slice(queryIdx + 1);

	const hashIdx = afterQuery.indexOf('#');
	const query = hashIdx >= 0 ? afterQuery.slice(0, hashIdx) : afterQuery;
	const hash = hashIdx >= 0 ? afterQuery.slice(hashIdx) : '';

	if (!query) return url;

	const pairs = query.split('&');
	const kept: string[] = [];
	for (const pair of pairs) {
		const eqIdx = pair.indexOf('=');
		const rawName = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
		let decodedName: string;
		try {
			decodedName = decodeURIComponent(rawName.replace(/\+/g, ' '));
		} catch {
			decodedName = rawName;
		}
		if (!isTrackingParam(decodedName)) kept.push(pair);
	}

	if (kept.length === pairs.length) return url;

	if (kept.length === 0) return beforeQuery + hash;
	return beforeQuery + '?' + kept.join('&') + hash;
}

export function stripTrackingParams(container: Element): void {
	for (const a of container.querySelectorAll('a[href]')) {
		const href = a.getAttribute('href');
		if (!href) continue;
		const cleaned = stripTrackingFromUrl(href);
		if (cleaned !== href) a.setAttribute('href', cleaned);
	}
}
