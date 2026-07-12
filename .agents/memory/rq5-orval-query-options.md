---
name: React Query v5 + Orval UseQueryOptions
description: Orval-generated hooks require queryKey in UseQueryOptions (React Query v5), use type assertion to avoid TS2741.
---

## Rule
When calling Orval-generated hooks with only `enabled` flag, cast the query options: `{ query: { enabled: ... } as any }`.

**Why:** TanStack Query v5 made `queryKey` required in `UseQueryOptions`. Orval v8 generates hooks that accept `UseQueryOptions<...>` directly (not `Partial<UseQueryOptions<...>>`), so passing just `{ enabled }` causes TS2741. The hook internally merges the queryKey, so runtime is correct.

**How to apply:** All `useGetXxx(id, { query: { enabled: ... } })` and `useListXxx(params, { query: { enabled: ... } })` calls need `as any` on the query object.
