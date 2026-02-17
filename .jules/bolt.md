## 2025-02-18 - Single IntersectionObserver
**Learning:** Instantiating a new `IntersectionObserver` for every item in a list (e.g., chapters) is an anti-pattern that consumes excessive memory and CPU, especially during initialization and scroll events. The `IntersectionObserver` API is designed to observe multiple targets with a single instance.
**Action:** Always check if multiple observers are being created for similar elements. Refactor to use a single observer instance that observes all target elements, using `entry.target.id` or data attributes to identify which element triggered the intersection.

## 2025-02-18 - Environment Variable Dependency in Demo Mode
**Learning:** The application fails to initialize entirely (white screen) if Supabase environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are missing, even when accessing routes like `/demo` that shouldn't require backend connection. This happens because `src/lib/supabase.ts` throws an error at module scope.
**Action:** Ensure dummy environment variables are present during CI/E2E testing or when running the dev server, even if not testing authenticated features.
