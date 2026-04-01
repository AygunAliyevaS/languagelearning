import {
	type RouteConfigEntry,
	index,
	route,
} from '@react-router/dev/routes';

const pageModules = import.meta.glob('./**/page.jsx');

function toRouteSegment(segment: string): string {
	if (!segment.startsWith('[') || !segment.endsWith(']')) {
		return segment;
	}

	const paramName = segment.slice(1, -1);
	if (paramName.startsWith('...')) {
		return '*';
	}
	if (paramName.startsWith('[') && paramName.endsWith(']')) {
		return `:${paramName.slice(1, -1)}?`;
	}
	return `:${paramName}`;
}

function toRouteEntry(pageFile: string): RouteConfigEntry {
	if (pageFile === './page.jsx') {
		return index(pageFile);
	}

	const routePath = pageFile.slice(2, -'/page.jsx'.length);
	const processedRoutePath = routePath.split('/').map(toRouteSegment).join('/');
	return route(processedRoutePath, pageFile);
}

if (import.meta.env.DEV && import.meta.hot) {
	if (import.meta.hot) {
		import.meta.hot.accept((newSelf) => {
			import.meta.hot?.invalidate();
		});
	}
}
const routes = Object.keys(pageModules)
	.slice()
	.sort((left, right) => {
		if (left === './page.jsx') return -1;
		if (right === './page.jsx') return 1;
		return left.localeCompare(right);
	})
	.map(toRouteEntry);
const notFound = route('*?', './__create/not-found.tsx');

routes.push(notFound);

export default routes;
