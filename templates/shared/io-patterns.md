# I/O Patterns (Performance)

## Parallel Reads

**ALWAYS** read multiple files in single tool call batch:

```
READ (parallel):
- {globalPath}/storage/state.json → {state}
- {globalPath}/storage/queue.json → {queue}
- {globalPath}/storage/ideas.json → {ideas}
- {globalPath}/storage/shipped.json → {shipped}
```

## Parallel Writes

**ALWAYS** write independent files in single batch:

```
WRITE (parallel):
- {globalPath}/context/now.md
- {globalPath}/context/next.md
- {globalPath}/storage/state.json
```

## Conditional Writes

Only write if content changed:

```
IF {newContent} != {existingContent}:
  WRITE file
ELSE:
  SKIP (no-op)
```

## File Count (Use Glob, NOT find)

```
GLOB: **/*.{ts,tsx,js,jsx} (exclude node_modules)
```

Never use `find` - Glob is 10x faster.

## Package.json (Single Read)

Read once, extract all:

```
READ: package.json → {pkg}

{projectName} = pkg.name
{version} = pkg.version
{scripts} = pkg.scripts
{deps} = {...pkg.dependencies, ...pkg.devDependencies}
{techStack} = detect from deps (react, vue, express, etc.)
```

## Ecosystem Detection (Single ls)

```bash
ls package.json bun.lockb pnpm-lock.yaml yarn.lock Cargo.toml go.mod 2>/dev/null
```

| Found | Package Manager |
|-------|-----------------|
| bun.lockb | bun |
| pnpm-lock.yaml | pnpm |
| yarn.lock | yarn |
| package-lock.json | npm |
| Cargo.toml | cargo |
| go.mod | go |
