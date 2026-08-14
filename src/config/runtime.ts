export type DeploymentMode = 'full-stack' | 'static';

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const isPagesBuild = import.meta.env.MODE === 'pages';
const useStaticMode = isPagesBuild && !configuredApiBaseUrl;

const allowFixtures =
  Boolean(import.meta.env.DEV) && String(import.meta.env.VITE_ALLOW_FIXTURE_ADAPTER || '') === 'true';

// Pages is a public static host. Never attach a usable API key there — it would
// ship in the JS bundle. Owner PII is same-origin Basic/API_KEY only.
const apiKey = isPagesBuild ? '' : String(import.meta.env.VITE_API_KEY || '').trim();

export const runtimeConfig = {
  deploymentMode: (useStaticMode ? 'static' : 'full-stack') as DeploymentMode,
  apiBaseUrl: configuredApiBaseUrl,
  isStatic: useStaticMode,
  isPagesBuild,
  ownerPiiEnabled: !isPagesBuild,
  allowFixtures,
  apiKey,
  apiUrl(path: string): string {
    return `${configuredApiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  },
};
