# Working in this repo

## The one hard rule

`src/playable-runtime/**` must never import React, Next.js, Node built-ins, or `zod` as a **value**.

That directory gets bundled by esbuild into the exported playable. A stray value import drags the whole dependency into a file that has to fit inside an ad network's size cap.

Types from the manifest are fine, as long as they are type-only:

```ts
import type { ProjectData, Orientation } from "@/types/project"; // OK, erased
import { ProjectDataSchema } from "@/types/project"; // NOT OK in runtime
```

Validation belongs in the API and editor layers. By the time data reaches the runtime it is already parsed.

## Three.js discipline

Three.js does not free GPU memory on garbage collection. Every geometry, material, texture, and render target an engine creates must go through `ResourceTracker` (`src/playable-runtime/three/resources.ts`) so `destroy()` can release it. The editor restarts the preview on nearly every edit, so a leak here surfaces as a dead canvas within a minute of use.

Performance defaults exist because playables run on cheap phones:

- Device pixel ratio is capped at 2.
- Shadow maps are off; engines draw blob shadows instead.
- No post-processing.
- Prefer `InstancedMesh` when object counts allow.

## Manifest changes

`src/types/project.ts` is the single source of truth. When adding a field:

1. Give it a `.default()` so existing stored projects keep parsing.
2. Use `.prefault({})` rather than `.default({})` for nested objects. In Zod 4, `.default()` short-circuits parsing and will not fill inner defaults.
3. Add it to `src/lib/project-defaults.ts` if new projects should start with a non-trivial value.
4. Surface it in the properties panel, or it is invisible to users.

Never rename or remove a field without a migration path; `projectData` is stored as raw JSON.

## Adding a new engine

1. Implement `Playable3DEngine` in `src/playable-runtime/engines/<id>/index.ts`.
2. Register it in `src/playable-runtime/engines/index.ts` and in the export factory map in `src/playable-runtime/export/export-html.ts`.
3. Add the template id to `TemplateIdSchema`.
4. Add a config schema on `GameplaySchema` and a defaults factory.
5. Add a card to the create-project dialog.

## Asset references

Anything in the manifest that points at a file is a plain string URL. The runtime uses it as-is. That works because:

- In the editor it is `/api/storage/...` or `/models/...`.
- In an export it has already been rewritten to a `data:` URI.

Curated library models are the exception: they are referenced by `libraryId` and resolved through the `assets` map passed into the runtime, which the exporter populates with data URIs.

## Next.js version

This project runs Next.js 16, which differs from most training data. Check `node_modules/next/dist/` or the official docs before assuming an API.
