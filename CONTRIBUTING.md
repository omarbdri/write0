# Contributing to write0

Thanks for taking the time to contribute! write0 is a **100% client-side** app (no backend, no API routes). Please keep changes small, reviewable, and focused.

## Quick Start

Use Node.js 22.12+ (22.x) or Node.js 24.x.

```bash
npm install
npm run dev
```

## Quality Checks

Run these before opening a PR:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

## Project Principles

- **No secrets in the client**: anything shipped to the browser is public.
- **Prefer boring code**: readable > clever.
- **Preserve behavior** unless fixing a bug or improving safety.
- **Accessibility matters**: keep keyboard navigation and labels in mind.

## What to Include in a PR

- A short description of the problem and the solution.
- Screenshots/GIFs for UI changes.
- Notes on edge cases (storage full, popup blocked for PDF export, etc.).

## Style & Conventions

- TypeScript + React function components.
- Keep props/state minimal; avoid derived-state anti-patterns.
- Use `useMemo` / `useCallback` only when it improves clarity or prevents real re-renders.

## Reporting Bugs

Please use the Bug Report template and include:

- Browser + OS
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)
