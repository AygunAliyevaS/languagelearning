import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();
const routeLoaders = {
  ...import.meta.glob('../src/app/api/**/route.js'),
  ...import.meta.glob('../src/app/api/**/route.ts'),
};

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

function getRouteFiles(): string[] {
  return Object.keys(routeLoaders)
    .slice()
    .sort((a, b) => {
      return b.length - a.length;
    });
}

// Helper function to transform file path to Hono route path
function getHonoPath(routeFile: string): { name: string; pattern: string }[] {
  const relativePath = routeFile
    .replace(/^\.\.\/src\/app\/api\/?/, '')
    .replace(/\/route\.(?:j|t)s$/, '');
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length === 0) {
    return [{ name: 'root', pattern: '' }];
  }
  const transformedParts = parts.map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (match) {
      const [_, dots, param] = match;
      return dots === '...'
        ? { name: param, pattern: `:${param}{.+}` }
        : { name: param, pattern: `:${param}` };
    }
    return { name: segment, pattern: segment };
  });
  return transformedParts;
}

// Import and register all routes
async function registerRoutes() {
  const routeFiles = getRouteFiles();

  // Clear existing routes
  api.routes = [];

  for (const routeFile of routeFiles) {
    try {
      const loadRoute = routeLoaders[routeFile as keyof typeof routeLoaders];
      if (!loadRoute) {
        continue;
      }
      const route = await loadRoute();

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        try {
          if (route[method]) {
            const parts = getHonoPath(routeFile);
            const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;
            const handler: Handler = async (c) => {
              const params = c.req.param();
              if (import.meta.env.DEV) {
                const updatedRoute = await loadRoute();
                return await updatedRoute[method](c.req.raw, { params });
              }
              return await route[method](c.req.raw, { params });
            };
            const methodLowercase = method.toLowerCase();
            switch (methodLowercase) {
              case 'get':
                api.get(honoPath, handler);
                break;
              case 'post':
                api.post(honoPath, handler);
                break;
              case 'put':
                api.put(honoPath, handler);
                break;
              case 'delete':
                api.delete(honoPath, handler);
                break;
              case 'patch':
                api.patch(honoPath, handler);
                break;
              default:
                console.warn(`Unsupported method: ${method}`);
                break;
            }
          }
        } catch (error) {
          console.error(`Error registering route ${routeFile} for method ${method}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error importing route file ${routeFile}:`, error);
    }
  }
}

// Initial route registration
const routesReady = registerRoutes();

// Hot reload routes in development
if (import.meta.env.DEV) {
  import.meta.glob('../src/app/api/**/route.js', { eager: true });
  import.meta.glob('../src/app/api/**/route.ts', { eager: true });
  if (import.meta.hot) {
    import.meta.hot.accept((newSelf) => {
      registerRoutes().catch((err) => {
        console.error('Error reloading routes:', err);
      });
    });
  }
}

export { api, API_BASENAME, routesReady };
