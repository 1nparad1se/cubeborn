/**
 * Build switch for every developer tool. A production build without them:
 *   VITE_DEV_TOOLS=0 npm run build
 * The Settings section, hotkeys, panel and overlays all check this flag first.
 */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
export const DEV_TOOLS_AVAILABLE: boolean = env?.VITE_DEV_TOOLS !== '0';
