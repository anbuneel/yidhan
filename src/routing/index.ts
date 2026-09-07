/**
 * The routing surface the rest of the app consumes.
 *
 * Deliberately narrow: only the symbols App and the components actually import.
 * `routes.ts`, `scrollMemory.ts`, `scrollRegion.ts` and `useRouter.ts` export more
 * than this to their own tests — re-exporting all of it here would create a second,
 * wider public API that nothing calls, which is what `npm run lint:exports` is for.
 */

export { isPublicPageRoute, routeToViewMode, type PublicPageName, type Route } from './routes';
export { clearScrollMemory } from './scrollMemory';
export { scrollRegionProps } from './scrollRegion';
export { useRouter } from './useRouter';
