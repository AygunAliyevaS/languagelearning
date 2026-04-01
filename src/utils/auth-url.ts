function getHeaderValue(headers: Headers, name: string): string | null {
	const value = headers.get(name);
	if (!value) {
		return null;
	}

	const [firstValue] = value.split(',');
	return firstValue?.trim() || null;
}

export function getAuthUrlFromRequest(request: Request): string {
	const configuredAuthUrl = process.env.AUTH_URL;
	if (configuredAuthUrl) {
		return configuredAuthUrl;
	}

	const forwardedProto = getHeaderValue(request.headers, 'x-forwarded-proto');
	const forwardedHost = getHeaderValue(request.headers, 'x-forwarded-host');
	const host = getHeaderValue(request.headers, 'host');

	const url = new URL(request.url);
	if (forwardedProto) {
		url.protocol = `${forwardedProto}:`;
	}
	if (forwardedHost ?? host) {
		url.host = forwardedHost ?? host ?? url.host;
	}

	url.pathname = '/api/auth';
	url.search = '';
	url.hash = '';

	return url.toString().replace(/\/$/, '');
}

export function isSecureAuthRequest(request: Request): boolean {
	return getAuthUrlFromRequest(request).startsWith('https://');
}