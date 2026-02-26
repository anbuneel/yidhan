# Security Scan Report

**Scan ID:** a3f7e91b
**Date:** 2026-02-25
**Scope:** Full codebase (899 dependencies scanned)

## Tools Run

| Tool | Status | Findings |
|------|--------|----------|
| Semgrep (SAST) | Skipped (not installed) | — |
| npm audit | Ran | 8 |
| Gitleaks (secrets) | Skipped (not installed) | — |

## Summary

**8 total vulnerabilities** found across npm dependencies:
- **Critical:** 0
- **High:** 5
- **Moderate:** 3
- **Low:** 0

Top concern: the `tar` package (transitive via `@capacitor/cli`) has 4 separate high-severity vulnerabilities including path traversal and arbitrary file write — CVSS up to 8.8. The `rollup` vulnerability (path traversal) is also notable since it's part of the build toolchain.

All 8 vulnerabilities have fixes available.

## SAST Findings (Semgrep)

Skipped — semgrep not installed.

## Dependency Vulnerabilities (npm audit)

| # | Severity | Package | Vulnerability | Fix Available |
|---|----------|---------|---------------|---------------|
| 1 | High | `tar` (<=7.5.7) | Race Condition via Unicode Ligature Collisions (CVSS 8.8) | Yes |
| 2 | High | `tar` (<=7.5.7) | Arbitrary File Creation/Overwrite via Hardlink Path Traversal (CVSS 8.2) | Yes |
| 3 | High | `tar` (<=7.5.7) | Arbitrary File Overwrite via Insufficient Path Sanitization | Yes |
| 4 | High | `tar` (<7.5.8) | Arbitrary File Read/Write via Hardlink-Symlink Chain (CVSS 7.1) | Yes |
| 5 | High | `@capacitor/cli` | Inherits `tar` vulnerabilities (transitive) | Yes |
| 6 | High | `@isaacs/brace-expansion` (<=5.0.0) | Uncontrolled Resource Consumption (ReDoS) | Yes |
| 7 | High | `minimatch` (multiple ranges) | ReDoS via repeated wildcards with non-matching literal | Yes |
| 8 | High | `rollup` (4.0.0–4.58.x, <2.80.0) | Arbitrary File Write via Path Traversal (CWE-22) | Yes |
| 9 | Moderate | `ajv` (<6.14.0, 7.x–8.17.x) | ReDoS when using `$data` option | Yes |
| 10 | Moderate | `lodash` (4.0.0–4.17.21) | Prototype Pollution in `_.unset` and `_.omit` (CVSS 6.5) | Yes |
| 11 | Moderate | `markdown-it` (13.0.0–14.1.0) | Regular Expression DoS (CVSS 5.3) | Yes |

> Note: `tar` has 4 separate advisories but counts as 1 vulnerable package. The table lists all advisories for completeness.

### Dependency Context

| Package | Direct/Transitive | Used By |
|---------|-------------------|---------|
| `tar` | Transitive | `@capacitor/cli` |
| `@capacitor/cli` | Direct (devDependency) | Capacitor native build tooling |
| `@isaacs/brace-expansion` | Transitive | glob/minimatch ecosystem |
| `minimatch` | Transitive | eslint, glob, rimraf, filelist |
| `rollup` | Transitive | Vite (bundler), workbox-build |
| `ajv` | Transitive | eslint, workbox-build |
| `lodash` | Transitive | various dev dependencies |
| `markdown-it` | Transitive | likely Tiptap or dev tooling |

## Secrets Detected (Gitleaks)

Skipped — gitleaks not installed.

## Recommendations

### Priority 1 — High Severity (act soon)

1. **Update `@capacitor/cli`** — This will resolve the `tar` vulnerabilities transitively. Check for a newer Capacitor CLI version:
   ```bash
   npm ls tar        # Confirm dependency chain
   npm update @capacitor/cli
   ```

2. **Update `rollup` via Vite** — The rollup path traversal (CWE-22) affects the build toolchain. Update Vite to pull in rollup >=4.59.0:
   ```bash
   npm ls rollup     # Check current version and parent
   npm update vite
   ```

3. **Update `minimatch`** — Transitive through eslint and glob tooling. Try:
   ```bash
   npm update minimatch
   ```
   If transitive locks prevent update, consider `npm audit fix` or overrides.

4. **Update `@isaacs/brace-expansion`** — ReDoS vulnerability. May require override if locked by transitive deps.

### Priority 2 — Moderate Severity

5. **`lodash` Prototype Pollution** — Only affects `_.unset`/`_.omit`. Low practical risk for this project since lodash is transitive (not directly used). Monitor for update.

6. **`ajv` ReDoS** — Only triggers with `$data` option enabled. Low practical risk. Update when convenient.

7. **`markdown-it` ReDoS** — Moderate severity. Update when Tiptap or related deps release a compatible version.

### General

- Run `npm audit fix` to attempt automatic resolution of all fixable vulnerabilities.
- For stubborn transitive dependencies, use `overrides` in `package.json` to force specific versions.
- Consider installing **Semgrep** and **Gitleaks** for comprehensive SAST and secret detection coverage in future scans.

## Skipped Tools

| Tool | Why Skipped | Install Instructions |
|------|-------------|---------------------|
| Semgrep (SAST) | Not installed on system | `pip install semgrep` or `brew install semgrep` |
| Gitleaks (secrets) | Not installed on system | `brew install gitleaks` or download from [GitHub releases](https://github.com/gitleaks/gitleaks/releases) |
