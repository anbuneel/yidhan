## 2026-02-16 - Reverse Tabnabbing Vulnerability
**Vulnerability:** Rich text sanitization allowed `target="_blank"` without `rel="noopener noreferrer"`.
**Learning:** `DOMPurify` configuration `ADD_ATTR: ['target']` does not automatically add security attributes to external links.
**Prevention:** Registered a global `DOMPurify` hook to enforce `rel="noopener noreferrer"` on all `target="_blank"` links.
