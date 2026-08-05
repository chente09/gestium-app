# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

GestiumSli is an Angular 19 (standalone components, no NgModules) internal management app for a legal/notification office (`gestium`). It handles staff itineraries, area-based activity scheduling, IESS/judicial process document generation (from `.docx` templates), and role-based user administration. Backend is Firebase (Auth, Firestore, Storage, Analytics, Cloud Functions) via `@angular/fire`. UI kit is `ng-zorro-antd`.

## Commands

```bash
npm start                # ng serve, http://localhost:4200
npm run build             # production build -> dist/gestium-sli
npm run watch              # dev build, watch mode
npm test                    # ng test (Karma + Jasmine, launches Chrome)
```

Run a single test file/suite: `ng test` runs the full Karma suite (no built-in single-file filter in this config); narrow with Jasmine's `fdescribe`/`fit` in the spec file instead.

There is no configured lint script (no `ng lint` / ESLint in `package.json`).

## Architecture

### Routing & access control (`src/app/app.routes.ts`)
Routes are grouped by access tier and composed with array spreads, not decorators:
- `publicRoutes` — login, public `consultas`.
- `basicProtectedRoutes` — any authenticated user (`canActivate(redirectUnauthorizedToLogin)` from `@angular/fire/auth-guard`).
- `adminRoutes` — itinerarios, demandas, matriz ISSFA, procesos — gated the same way (auth only, not role-checked at the route level here).
- `superAdminRoutes` — `admin/users`, additionally gated by the custom `AdminGuard`.
- `errorRoutes` — `unauthorized`, `not-found`, wildcard fallback.

Two auth patterns coexist:
- `@angular/fire/auth-guard`'s `canActivate`/`redirectUnauthorizedTo` for simple "must be logged in" routes.
- Custom `CanActivateFn` guards in `src/app/guards/` (e.g. `authAreaGuard` in `guards/areas/area.guard.ts`) for role/area-aware checks, reading `RegistersService.getCurrentRegister()` rather than Firebase Auth claims directly.

### Identity model: `User` (Firebase Auth) vs `Register` (Firestore profile)
- `UsersService` (`services/users/users.service.ts`) wraps Firebase Auth: login/register/Google sign-in, session vs local persistence, password reset, and a `users/{uid}.roles` lookup (`getUserRoles`/`hasRole`) — this is a *legacy/secondary* roles path.
- `RegistersService` (`services/registers/registers.service.ts`) is the primary authorization source of truth: it owns the `Register` document (`registers/{uid}`) with `role: 'admin' | 'coordinador' | 'empleado'` and `areaAsignada`, caches it on `currentRegister` after login, and exposes `isCurrentUserAdmin()` / `canAccessArea()`. Google login is restricted to emails containing `gestium` and auto-provisions a `Register` on first sign-in. Guards and components read `RegistersService`, not `UsersService`, for role decisions.
- `RegistersService` also owns `AreaOficina` (office areas) CRUD under the `areasOficina` collection, including slug generation and soft-delete (`activo: false`).

### Role model
Three roles: `admin`, `coordinador` (full cross-area access), `empleado` (restricted to their own `areaAsignada`). This pattern repeats across guards, `AreaActivitiesService`, and area/itinerary pages — when adding a new protected feature, follow the same `role`/`areaAsignada` check rather than inventing a new permission scheme.

### Document generation (`services/document/documento.service.ts`)
Generates `.docx` files client-side via `docxtemplater` + `pizzip`, filling templates stored under `public/assets/**` (organized by process type: `procOrdinario`, `matrizIssfa`, `providencia/{individual,agrupados}/{natural,juridica}`, `rpv/{natural,juridica}`, `opi/{individual,agrupados}/{natural,juridica}`). The `templates` map mirrors this folder structure — adding a new document type means adding both a template file under `public/assets` and an entry here. This is the highest fan-in module in the codebase (used from `demandas-bp`, `matriz-doc-isffa`, `gestionProcesos` pages).

### Activities/agenda (`services/areaActivities`, `components/agenda-area`)
`AreaActivitiesService` resolves an area's slug and filters Firestore activity queries by area + date range, respecting the role/area model above. `AgendaAreaComponent` is the largest single component by call fan-in (week/day/month views, activity loading, date-key bucketing) — check `services/date-utils/date-utils.service.ts` (`getFechaActualEcuador`, etc., Ecuador-timezone-aware) before adding new date logic instead of reimplementing it.

### Shared static data (`services/sharedData/shared-data.service.ts`)
Centralizes dropdown/select option lists (areas, unidades, materias, diligencias, etc.) used across forms — extend these lists here rather than hardcoding option arrays in components.

### Firebase config
`app.config.ts` wires up Firebase (Auth, Firestore, Storage, Analytics) with `initializeApp` called inline with literal config values (not environment files — there's no `src/environments/`). `firebase.json` is currently empty (`{}`); hosting/functions config is not yet checked into this repo.

### Path aliasing
None configured — imports are relative (`../../services/...`).
