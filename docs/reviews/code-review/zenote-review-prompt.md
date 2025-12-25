# Comprehensive Code Review Prompt: Zenote Application

## Project Context
**Application**: Zenote - A calm, distraction-free note-taking app with wabi-sabi design  
**Repository**: https://github.com/anbuneel/zenote  
**Reviewed By**: [Coding Agent]  
**Date**: December 2025

---

## PART 1: USER INTERFACE & DESIGN REVIEW

### 1.1 Visual Design & Wabi-Sabi Principles
Evaluate how well the application implements wabi-sabi aesthetic principles:

- **Kanso (Simplicity)**: Does the UI avoid unnecessary complexity? Are visual elements minimal yet functional?
- **Yugen (Mysterious Profundity)**: Does the design evoke calm and introspection? Are there subtle visual elements that reward discovery?
- **Seijaku (Tranquility)**: Is the color palette muted and calming? Do animations feel natural and unhurried?
- **Fukinsei (Imperfection)**: Are there intentional asymmetries or organic spacing that feel authentic rather than overly polished?
- **Shizen (Naturalness)**: Do typography, imagery, and materials feel organic? Is there a connection to natural aesthetics?

### 1.2 Component Accessibility
- **WCAG 2.1 Compliance**: Is the app AA or AAA compliant? Check color contrast ratios (4.5:1 minimum for text, 3:1 for UI components)
- **Keyboard Navigation**: Can users navigate the entire app with keyboard only? Are focus indicators visible and clear?
- **Screen Reader Support**: Are aria-labels, aria-describedby, and semantic HTML used appropriately?
- **Motion & Animations**: Are reduced-motion preferences respected? Is animated content skippable?
- **Dynamic Type Support**: Can users scale text without breaking layout?

### 1.3 Responsive Design
- **Mobile-First Approach**: Is the design mobile-first or retrofitted?
- **Breakpoint Strategy**: Are breakpoints justified (640px, 768px, 1024px, 1280px)? Do they match content flow?
- **Touch Targets**: Are interactive elements ≥48x48px on mobile? Is spacing adequate for touch?
- **Viewport Meta Tag**: Is viewport meta tag correctly configured?
- **Fluid Typography**: Does font size scale responsively or use fixed pixel values?

### 1.4 Component Library & Design System
- **Consistency**: Are colors, spacing, typography applied consistently throughout?
- **Reusability**: Are UI components (buttons, inputs, cards, modals) properly abstracted and reused?
- **Design Tokens**: Are CSS variables used for colors, spacing, fonts, shadows, border-radius?
- **Dark Mode Support**: Is dark mode properly implemented with adequate contrast and color preservation?
- **Component Documentation**: Are components documented with usage patterns and variants?

---

## PART 2: ARCHITECTURE REVIEW

### 2.1 Application Structure & Organization
- **Directory Structure**: Is the codebase organized logically? (e.g., `/src/components`, `/src/hooks`, `/src/utils`, `/src/services`, `/src/types`)
- **File Naming Conventions**: Are files named consistently? (e.g., PascalCase for components, camelCase for utilities)
- **Separation of Concerns**: Are UI, business logic, and data management properly separated?
- **Feature vs. Technical Structure**: Which approach is used? Is it scalable for growth?
- **Dead Code**: Are there unused imports, components, or utility functions?

### 2.2 State Management Architecture
- **State Management Solution**: What's used (Redux, Zustand, Context API, Jotai)? Is it justified?
- **Global vs. Local State**: Is the distinction clear? Are local states handled correctly in components?
- **Store Structure**: If Redux/Zustand, is the store normalized? Are reducers/actions well-organized?
- **Performance**: Are selectors memoized? Is unnecessary re-rendering minimized?
- **Debugging**: Is Redux DevTools or equivalent integrated? Can state changes be traced?

### 2.3 Data Flow & Communication
- **API Integration**: How are API calls structured? (custom hooks, service layer, middleware)
- **Error Handling**: Are API errors caught and displayed to users? Is retry logic implemented?
- **Loading States**: Are loading states managed across the app? Is skeleton/shimmer UI used?
- **Data Caching**: Is response caching implemented? How is stale data handled?
- **WebSocket/Real-time**: If notes sync across devices, how is real-time communication handled?

### 2.4 Authentication & Authorization (if applicable)
- **Auth Method**: Is it OAuth, JWT, session-based, or passwordless?
- **Token Management**: Where are tokens stored (localStorage, sessionStorage, memory, cookies)?
- **Refresh Logic**: How are expired tokens refreshed? Is there a logout cleanup?
- **Role-Based Access**: If users have different permissions, is access control enforced?
- **Security Headers**: Are CSP, X-Frame-Options, X-Content-Type-Options set correctly?

### 2.5 Routing & Navigation
- **Router Setup**: Is React Router v6+ properly configured with loaders/actions?
- **Route Organization**: Are routes hierarchically organized? Is lazy loading implemented?
- **Navigation Flow**: Is the navigation intuitive? Are deep links supported?
- **History Management**: Is browser history correctly managed? Do back/forward buttons work?
- **Error Routes**: Is a 404 page or error boundary implemented?

### 2.6 Performance Optimization
- **Code Splitting**: Are routes lazy-loaded? Are heavy components split?
- **Bundle Size**: Is the bundle optimized? (check with `npm run build`)
- **Image Optimization**: Are images lazy-loaded? Are multiple sizes provided (srcset)?
- **Caching Strategy**: Are assets cached? Is service worker implemented?
- **Rendering Performance**: Are components properly memoized (React.memo, useMemo)?

---

## PART 3: CODE QUALITY REVIEW

### 3.1 React Best Practices
- **Functional Components**: Are class components eliminated in favor of functional components with hooks?
- **Hook Rules**: Are hooks used only at the top level? Are dependencies arrays correct in useEffect?
- **Custom Hooks**: Are custom hooks extracted for reusable logic? Are they properly documented?
- **Prop Drilling**: Is prop drilling minimized? Could Context API or state management help?
- **Key Props**: Are list items properly keyed (never use index)?
- **Fragment Usage**: Are unnecessary `<div>` wrappers replaced with `<>`?

### 3.2 TypeScript Compliance (if used)
- **Type Coverage**: Is 80%+ of codebase typed? Are `any` types minimized?
- **Component Props**: Are component props properly typed? Is JSX.Element return type correct?
- **Utility Types**: Are utility types (Omit, Pick, Partial, Required) used appropriately?
- **Generics**: Are generics properly constrained? Do complex types have clear names?
- **Type Imports**: Are `import type` statements used to separate type imports?

### 3.3 Code Style & Formatting
- **Linting**: Is ESLint configured? Are there ignored rules that should be fixed?
- **Formatting**: Is Prettier applied consistently? Are formatting conflicts resolved?
- **Naming Conventions**: Are variables/functions named descriptively? Avoid single-letter names (except loop counters)
- **Function Length**: Are functions under 50 lines? Are complex functions broken down?
- **Nesting Depth**: Is nesting depth limited (max 3-4 levels)? Can early returns reduce nesting?

### 3.4 Error Handling & Validation
- **Input Validation**: Are user inputs validated (type, length, format)?
- **Error Boundaries**: Are Error Boundaries implemented to catch React rendering errors?
- **Try-Catch Blocks**: Are async operations wrapped in try-catch? Are errors logged?
- **User Feedback**: When errors occur, are users informed clearly?
- **Logging**: Is there structured logging? Are errors sent to monitoring service (Sentry)?

### 3.5 Documentation
- **README**: Is the README comprehensive? Does it cover setup, usage, features, contribution guidelines?
- **Code Comments**: Are comments used to explain "why" rather than "what"? Are JSDoc comments present?
- **Type Documentation**: Do complex types have descriptions? Are edge cases documented?
- **Storybook**: Is Storybook used for component documentation?
- **Architecture Docs**: Is there an `ARCHITECTURE.md` explaining design decisions?

---

## PART 4: TEST COVERAGE REVIEW

### 4.1 Unit Tests
- **Coverage Target**: What's the current coverage percentage? Is 80%+ achieved for critical paths?
- **Test Framework**: Is Jest, Vitest, or Mocha used? Is configuration optimal?
- **Testing Library**: Is React Testing Library used (not shallow testing)?
- **Test Organization**: Are tests co-located with components or in separate `/tests` directory?
- **Test Clarity**: Are test descriptions clear and follow AAA pattern (Arrange, Act, Assert)?

### 4.2 Component Tests
- **Render Tests**: Do components render without crashing?
- **Props Testing**: Are props correctly passed and rendered?
- **User Interaction**: Are click handlers, form submissions, and keyboard events tested?
- **Conditional Rendering**: Are different states (loading, error, success) tested?
- **Edge Cases**: Are boundary conditions tested (empty arrays, null values, very long strings)?

### 4.3 Integration Tests
- **API Mocking**: Is MSW (Mock Service Worker) used for API mocking?
- **User Workflows**: Are full user journeys tested (create note → edit → delete)?
- **State Updates**: Do state management changes trigger expected component updates?
- **Navigation**: Are route changes and redirects tested?

### 4.4 E2E Tests (if applicable)
- **Tool Used**: Is Cypress, Playwright, or Webdriver used?
- **Critical Paths**: Are main user flows covered (login → create → save)?
- **Cross-Browser**: Are tests run on multiple browsers?
- **Flakiness**: Are tests stable? Is there proper waiting for async operations?

### 4.5 Coverage Gaps
- **Untested Paths**: Which functions/components lack tests? Why?
- **Happy vs. Sad Paths**: Are both success and error scenarios tested?
- **Performance Testing**: Are there load tests for large note collections?
- **Accessibility Testing**: Are a11y tests run (jest-axe, pa11y)?

---

## PART 5: SCALABILITY & PERFORMANCE REVIEW

### 5.1 Data Structure Scalability
- **Large Collections**: How does the app perform with 1,000+ notes? 10,000+ notes?
- **Pagination/Virtualization**: Is infinite scroll or pagination implemented? Are large lists virtualized?
- **Search Performance**: How fast is note search? Is there full-text search with proper indexing?
- **Storage Model**: Is data denormalized appropriately? Are relationships clear?

### 5.2 Network Performance
- **API Efficiency**: Are endpoints returning only needed fields?
- **Request Batching**: Are multiple requests batched when possible?
- **GraphQL vs. REST**: If using GraphQL, is over-fetching avoided?
- **Compression**: Are responses gzip-compressed?
- **CDN Usage**: Are static assets served from CDN?

### 5.3 Runtime Performance
- **Rendering Profiling**: Does the app maintain 60fps during interactions?
- **Memory Leaks**: Are subscriptions/intervals properly cleaned up?
- **Bundle Size**: Is tree-shaking effective? Are unused dependencies removed?
- **Lighthouse Score**: What are the app's Lighthouse scores (Performance, Accessibility, Best Practices, SEO)?
- **Core Web Vitals**: Are LCP, FID, CLS within acceptable ranges?

### 5.4 Deployment & Infrastructure
- **Environment Configuration**: Are dev, staging, and production environments clearly separated?
- **CI/CD Pipeline**: Is there automated testing on commits? Does it deploy to staging/production?
- **Database Scaling**: If using a database, can it scale? Are indexes optimized?
- **Caching Strategy**: Is HTTP caching headers set? Is Redis/similar used?
- **Monitoring**: Are errors, performance metrics, and user analytics tracked?

### 5.5 Concurrent User Support
- **Server Capacity**: Can the backend handle expected concurrent users?
- **Database Connections**: Is connection pooling used?
- **Rate Limiting**: Is API rate limiting implemented?
- **WebSocket Scaling**: If real-time features exist, can WebSocket servers scale?

---

## PART 6: SECURITY REVIEW

### 6.1 Authentication & Authorization
- **Password Security**: If passwords are used, are they hashed (bcrypt, Argon2)? Is password strength enforced?
- **Session Management**: Are sessions secure? Is CSRF protection in place?
- **OAuth/OIDC**: If using social login, are flows properly secured?
- **MFA**: Is multi-factor authentication supported?
- **Token Expiration**: Do tokens expire? Is refresh token rotation implemented?

### 6.2 Input Validation & Sanitization
- **XSS Prevention**: Are user inputs sanitized before display? Is innerHTML avoided?
- **SQL Injection**: If using raw SQL, are prepared statements used? (Use ORM if possible)
- **Command Injection**: Are shell commands avoided for user data?
- **File Upload**: Are uploaded files validated (type, size)? Are they stored safely?
- **Input Length**: Are input limits enforced?

### 6.3 Data Protection
- **Encryption in Transit**: Is HTTPS enforced? Are API calls over HTTPS?
- **Encryption at Rest**: Are sensitive data fields encrypted in database?
- **PII Handling**: How is personally identifiable information (PII) handled?
- **Data Deletion**: When users delete accounts, is all data removed?
- **Audit Logs**: Are sensitive actions logged?

### 6.4 Frontend Security
- **Source Map Exposure**: Are source maps disabled in production?
- **Secrets Management**: Are API keys/secrets in environment variables (never hardcoded)?
- **CSP Headers**: Is Content Security Policy properly configured?
- **Clickjacking Protection**: Is X-Frame-Options header set to DENY?
- **CORS**: Is CORS properly configured (whitelist origins)?

### 6.5 Dependency Security
- **Vulnerable Dependencies**: Are there known vulnerabilities? (check `npm audit`)
- **Dependency Audits**: Is `npm audit` run regularly? Are patches applied?
- **Supply Chain**: Are dependencies from trusted sources?
- **License Compliance**: Are all licenses compatible (Apache, MIT, GPL)?
- **Dependency Updates**: Is there a strategy for keeping dependencies current?

### 6.6 API Security
- **Authentication**: Are all endpoints protected? Is public access intentional?
- **Rate Limiting**: Are endpoints rate-limited?
- **Input Validation**: Are API inputs validated on server-side?
- **Error Messages**: Do error messages leak sensitive information?
- **Versioning**: Is API versioning supported for backward compatibility?

### 6.7 Security Testing
- **Penetration Testing**: Has the app been tested for vulnerabilities?
- **OWASP Top 10**: Are protections against OWASP Top 10 in place?
- **Security Headers**: Are all security headers (HSTS, X-Content-Type-Options, etc.) set?
- **API Security**: Are API endpoints tested with invalid/malicious inputs?

---

## PART 7: SPECIFIC ZENOTE CONSIDERATIONS

### 7.1 Note Persistence & Sync
- **Local Storage vs. Cloud**: Are notes stored locally, cloud, or both?
- **Offline Support**: Can users create/edit notes offline? Is sync queued?
- **Conflict Resolution**: If notes are edited on multiple devices, how are conflicts handled?
- **Data Integrity**: Are notes encrypted end-to-end (E2EE)?
- **Backup Strategy**: Can users backup/export notes?

### 7.2 Rich Text / Markdown Support
- **Editor Library**: What's used (Draft.js, ProseMirror, TipTap, Monaco)?
- **Formatting Preservation**: Are formatting and styles preserved on save?
- **Markdown Parsing**: If Markdown is supported, is parsing secure (sanitized)?
- **Collaborative Editing**: If multiple users can edit, is Operational Transformation or CRDT used?

### 7.3 Aesthetic & Wabi-Sabi Design Consistency
- **Animation Performance**: Do animations use GPU-accelerated properties (transform, opacity)?
- **Font Loading**: Are custom fonts optimized? Is font fallback strategy clear?
- **Whitespace**: Is whitespace used intentionally to create visual calm?
- **Color Palette**: Is the palette limited and cohesive?
- **Responsive Aesthetics**: Does the wabi-sabi aesthetic scale across device sizes?

### 7.4 Note Organization
- **Search & Filter**: Is note search optimized? Can users filter by date, tags, or categories?
- **Navigation**: Can users quickly find notes? Is there a good IA (information architecture)?
- **Archiving**: Can users archive old notes without deletion?
- **Export**: Can users export notes (PDF, Markdown, JSON)?

---

## PART 8: RECOMMENDATIONS & ACTION ITEMS

### Critical Issues (Fix Immediately)
- [ ] Security vulnerabilities in dependencies
- [ ] XSS or injection vulnerabilities
- [ ] Authentication/authorization flaws
- [ ] Critical accessibility issues (WCAG Level A violations)

### High Priority (Fix within 1-2 sprints)
- [ ] Performance issues affecting UX
- [ ] Test coverage below 60%
- [ ] Type safety issues (if using TypeScript)
- [ ] Missing error handling

### Medium Priority (Fix within 1 month)
- [ ] Code style inconsistencies
- [ ] Accessibility improvements (WCAG AA)
- [ ] Documentation gaps
- [ ] Dependency updates

### Low Priority (Nice to Have)
- [ ] Component refactoring for DRY
- [ ] Additional test coverage
- [ ] Performance optimizations beyond Lighthouse
- [ ] Extended documentation (Storybook, architecture guides)

---

## REVIEW SIGN-OFF

**Reviewer**: [Agent Name]  
**Review Date**: [Date]  
**Overall Assessment**: [Pass / Conditional Pass / Needs Improvement]  
**Key Strengths**: 
- [List top 3 strengths]

**Key Weaknesses**:
- [List top 3 areas for improvement]

**Estimated Remediation Time**: [X hours/days]

---

## APPENDICES

### A. Tools & Commands for Self-Assessment
```bash
# Dependency security audit
npm audit
npm outdated

# Code quality analysis
npx eslint src/
npx prettier --check src/

# TypeScript checking
npx tsc --noEmit

# Bundle analysis
npm run build
npx webpack-bundle-analyzer dist/stats.json

# Lighthouse audit
npx lighthouse https://app-url --view

# Test coverage
npm run test -- --coverage

# Performance profiling
npm run build
npm start (with React DevTools Profiler)
```

### B. Key Metrics to Track
- **Code Coverage**: Unit + Integration + E2E
- **Bundle Size**: Target < 500KB gzipped
- **Lighthouse Scores**: All > 90
- **Page Load Time**: < 3s on 4G
- **Security Score**: OWASP compliance
- **Error Rate**: < 0.1% in production
- **User Satisfaction**: NPS score

### C. Continuous Improvement Checklist
- [ ] Weekly dependency updates review
- [ ] Monthly security audit
- [ ] Quarterly performance review
- [ ] Bi-annual accessibility audit
- [ ] Annual architecture review
