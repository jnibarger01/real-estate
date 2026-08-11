export type DeploymentMode = 'full-stack' | 'static';

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const isPagesBuild = import.meta.env.MODE === 'pages';
const useStaticMode = isPagesBuild && !configuredApiBaseUrl;

export const runtimeConfig = {
  deploymentMode: (useStaticMode ? 'static' : 'full-stack') as DeploymentMode,
  apiBaseUrl: configuredApiBaseUrl,
  isStatic: useStaticMode,
  apiUrl(path: string): string {
    return `${configuredApiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  },
};
