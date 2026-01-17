# AGENTS.md

This document provides guidelines for AI agents working on the Nexata API codebase.

## Important Guidelines

- **Do not commit changes** - The git diff is used by developers to review and debug changes. Only commit when explicitly requested.
- **Do not create migrations** - Migration generation is part of review process after changes are confirmed. Only run migrations with `bun run mig:push` when explicitly requested.

## Build, Lint, and Test Commands

All commands assume Bun is installed. Run from `/home/luka/Documents/nexata/api`.

### Development
```bash
bun run dev              # Start dev server with hot reload
bun run --watch src/index.ts  # Alternative dev command
```

### Database Migrations
```bash
bun run mig              # Generate new migrations
bun run mig:push         # Push migrations to database
```

### Linting and Formatting
```bash
bun run check            # Run Biome check with fix, unsafe fixes, and verbose output
```

### Testing
No test scripts are currently configured in package.json. Run individual tests using your preferred test runner when tests are added.

## Code Style Guidelines

### TypeScript
- Strict mode is enabled in `tsconfig.json`
- Use explicit types for function parameters and return values
- Avoid `any`; use `unknown` with proper type narrowing instead
- Use `Static<typeof schema>` for type extraction from TypeBox schemas

### Imports
- Use the `@api/` alias for internal imports (e.g., `@api/schema`, `@api/utils/env`)
- Group imports in this order: external packages, then internal @api/ imports
- Use named imports: `import { foo } from 'package'` not `import pkg from 'package'`
- Do not add comments to imports

### Database (Drizzle ORM)
- Database columns use `snake_case` (configured in `drizzle.config.ts`)
- Use `eq()`, `and()`, `exists()` from `drizzle-orm` for queries
- Use `createSelectSchema`, `createInsertSchema`, `createUpdateSchema` from `drizzle-typebox`
- Access query results with `.at(0)` for single items or iterate for arrays
- Use `onConflictDoUpdate` for upsert patterns

### Neon HTTP Serverless Limitations
- **Transactions are not available** with Neon HTTP Serverless
- For atomic operations spanning multiple queries, use `await db.batch([query1, query2, ...])`
- For non-atomic operations, use `Promise.all([query1(), query2()])`
- **Prefer single queries when possible**:
  - Use `.with()` to add subqueries
  - `db.insert(table).values([])` accepts an array for bulk inserts
  - Compress multiple update/delete operations into single queries with conditional logic
  - Use `onConflictDoUpdate` or `onConflictDoNothing` for error handling

### API Routes (ElysiaJS)
- Create routers using `new Elysia({ prefix: '/route', tags: ['Tag'] })`
- Use `.use(subRouter)` to compose routers
- Add OpenAPI details with `{ detail: { summary: '...', description: '...' } }`
- Use TypeBox for validation: `t.Object({ ... })`, `t.String()`, `t.Number()`, etc.
- Use `tObject({ ... })` helper for complex object schemas in headers/body with `additionalProperties: false`
- Use `Nullish(type)` helper for optional nullable types: `Nullish(t.String())`
- Route handlers are async functions returning promises
- Use `.guard({ headers: tObject({ ... }) })` for header validation
- Use `.derive(({ headers }) => ({ ... }))` for derived context
- Use `.resolve(async ({ ... }) => ({ ... }))` for resolved context (middleware)

### Error Handling and Logging
- Throw HTTP errors using `HttpError` from `elysia-logger`:
  ```typescript
  throw HttpError.Unauthorized()
  throw HttpError.Forbidden()
  throw HttpError.BadRequest('message')
  throw HttpError.NotFound()
  throw HttpError.Conflict('message')
  throw HttpError.InternalServerError('message')
  ```
- Use the `log` function from `@api/utils/env`:
  ```typescript
  log('error', 'message')
  log('warn', 'message')
  log('log', 'message')
  log('debug', 'message')
  log('verbose', 'message')
  ```
- The logger is a wrapper around `elysia-logger` with auto-json formatting
- Use `IS_PRODUCTION` flag to conditionally log or handle errors

### Schema Patterns
- Use `pgEnum` for enums: `pgEnum('enum_name', Object.values(Enum) as [Enum])`
- Use `uniqueIndex` and `index` for database indexes
- Use `lowerIndex` utility for case-insensitive unique indexes
- Use `sqlArray` for array defaults: `.default(sqlArray([], enumName))`
- Use `desc()` for descending order indexes
- Vector columns use `vector({ dimensions: 1024 })` with HNSW index for cosine similarity

### SQL Utilities
- Use `lower()`, `coalesce()`, `jsonBuildObject()`, `jsonAgg()` from `@api/utils/sql`
- Use `sqlCase()` and `whenThen()` for conditional SQL logic
- Use `boolOr()` for boolean aggregations
- Use `matchRegex()` for regex pattern matching

### Environment Variables
- Use `requireEnv('VAR_NAME')` for required environment variables (throws if missing)
- Use `warnEnv('VAR_NAME')` to log a warning if optional env var is missing
- Use environment variables for all configuration
- Never log or expose credentials, API keys, or sensitive secrets

### Authentication and OAuth
- Use `authPlugin(admin?: boolean)` guard for protected routes
- Access authenticated user via `activeUser` in route handlers
- JWT tokens use `jwt` plugin, refresh tokens use `refreshJwt` plugin
- Use `OauthProvider` and `OauthScope` enums for OAuth configuration
- Store OAuth state in cache with TTL
- Use extended state patterns: `oauthLoginExtendedState`, `oauthCredentialExtendedState`
- Use `getOauthCallback(key)` to construct callback URLs

### AI/ML Model Patterns
- Models configured with fallback chains using `ai-fallback`: `createFallback({ models: [...], ... })`
- Available models: `MODEL` (general), `REASONING_MODEL`, `VLM_MODEL` (vision), `EMBEDDING_MODEL`
- Use `generateText()` with `jsonSchema` output for structured LLM responses
- Use `embedMany()` for batch embedding generation
- Configure `FALLBACK_BEHAVIOR` with error handlers and retry logic
- Constants: `EMBEDDING_SIZE` (768), `EMBEDDING_DIMENSIONS` (1024), `EMBEDDING_OVERLAP` (94)

### File Processing Patterns
- Use `sharp` library for image processing
- Check image relevance with `isRelevantImage(width, height)` before processing
- Use `mdSplitter` for markdown text chunking with `EMBEDDING_SIZE` and `EMBEDDING_OVERLAP`
- Validate MIME types before processing
- Generate embeddings for file chunks and store in vector database

### Tool Integration Patterns
- Use `toolify` helper to create AI tools from functions
- Tools accept `Static<typeof schema>` for input validation
- Use `jsonSchema` from `ai` package to convert TypeBox schemas
- Tools support multi-context execution and output molding
- Import tools from `@api/chat/tools/` directory

### Billing and Rate Limiting
- Track usage in cache with keys like `tenant:usage:{slug}`
- Check `count.used + 1 >= count.limit` before allowing operations
- Throw `HttpError.MethodNotAllowed('MESSAGE_LIMIT_REACHED')` for quota exceeded
- Use `bill` schema for billing records with `createdAt` descending index
- Track billable events separately for analytics

### Integration Patterns
- Use provider-specific clients (e.g., `Dropbox.fromRequest(activeUser, credentialId)`)
- Store credentials with `provider`, `scopes`, and token expiration
- Use `getAccessTokenForUser()` helper to retrieve valid tokens
- Handle external service errors with `HttpError.Conflict('EXTERNAL_ERROR')`
- Implement file categorization enums for integrations

### Naming Conventions
- Files: `kebab-case` for utilities, `camelCase` for router modules
- Variables/functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types/Interfaces: `PascalCase`
- Database tables: `snake_case` (e.g., `user`, `billable_event`)
- OpenAPI tags: `PascalCase` (e.g., 'User', 'Auth')

### Plugin Pattern
Create reusable plugins using the factory pattern:
```typescript
export const pluginName = (option?: boolean) =>
  (app: Elysia) =>
    app
      .use(someDependency)
      .resolve(async ({ ... }) => ({ ... }));
```

### File Structure
```
src/
  index.ts              # App entry point, mounts all routers
  env.ts                # Database, cache, and model exports
  schema/               # Drizzle schema definitions
  utils/                # Shared utilities (env, auth, type, sql, etc.)
  {module}/             # Feature modules (auth, user, chat, file, etc.)
    index.ts            # Main router
    lib.ts              # Module-specific utilities
    {submodule}/        # Sub-routers (e.g., auth/google, user/me)
```

### Database Caching
- Uses Upstash Redis for caching
- Cache keys should be descriptive and include entity IDs: `device:${userId}:${fingerprint}`
- Set expiration with `{ ex: seconds }` option
- Cache OAuth states with TTL for security

### Security Best Practices
- Always validate inputs with TypeBox schemas
- Use proper HTTP error codes for API responses
- Set appropriate cache expiration times
- Never expose internal system details or error messages to clients
- Store credentials with proper encryption and token expiration

### Permission System

#### Overview
Nexata uses a multi-level permission system for files and credentials based on:
1. User's tenant membership (`user.slug`)
2. Tenant admin status (`user.isAdmin`)
3. Direct ownership (`credential.userId`, `file.userId`)
4. Explicit permissions (`credentialPermission`, `filePermission`)

#### Permission Levels (Priority Order)
For **DELETE/admin operations** (strict - requires admin rights):
1. Tenant Admin - can delete any file/credential in their tenant
2. Credential Owner - owns the credential linked to the file
3. Credential Admin - has `credentialPermission.isAdmin = true` on the file's credential
4. File Owner - owns the file directly
5. File Admin - has `filePermission.isAdmin = true`

For **SELECT/read operations** (permissive - any permission grants access):
Same hierarchy, but any `credentialPermission` (not just admin) grants credential/file access.

#### Permission Schemas

**credentialPermission** (composite PK: credentialId + userId):
- `credentialId`: Reference to credential
- `userId`: User granted permission
- `isAdmin`: Boolean - if true, user has admin rights (can delete/manage)

**filePermission**:
- `id`: UUID primary key
- `fileId`: Reference to file
- `userId`: User granted permission (optional)
- `email`: Email for users not yet in system (optional)
- `isAdmin`: Boolean - if true, user has admin rights (can delete)

**credential.userId**:
- Owner of the credential, has implicit admin rights

**file.userId**:
- Owner of the file, has implicit admin rights

#### Implementation Pattern

**DELETE endpoints** (requires admin permission):
```typescript
and(
  inArray(file.id, ids),
  activeUser.isAdmin
    ? exists(
        db.select({ id: user.id })
          .from(user)
          .where(
            and(
              eq(user.id, file.userId),
              eq(user.slug, activeUser.slug), // Tenant scoping
            ),
          ),
      )
    : or(
        exists(
          db.select({ credentialId: credential.id })
            .from(credential)
            .where(
              and(
                eq(credential.id, file.credentialId),
                or(
                  eq(credential.userId, activeUser.id),
                  exists(
                    db.select({ userId: credentialPermission.userId })
                      .from(credentialPermission)
                      .where(
                        and(
                          eq(credentialPermission.credentialId, credential.id),
                          eq(credentialPermission.userId, activeUser.id),
                          eq(credentialPermission.isAdmin, true),
                        ),
                      ),
                  ),
                ),
              ),
            ),
        ),
        eq(file.userId, activeUser.id),
        exists(
          db.select({ id: filePermission.id })
            .from(filePermission)
            .where(
              and(
                eq(filePermission.fileId, file.id),
                or(
                  eq(filePermission.userId, activeUser.id),
                  eq(filePermission.email, activeUser.email),
                ),
                eq(filePermission.isAdmin, true),
              ),
            ),
        ),
      ),
)
```

**SELECT/SEARCH endpoints** (any permission):
```typescript
and(
  eq(user.slug, activeUser.slug),
  activeUser.isAdmin ? undefined : or(
    exists(
      db.select({ credentialId: credential.id })
        .from(credential)
        .where(
          and(
            eq(credential.id, file.credentialId),
            or(
              eq(credential.userId, activeUser.id),
              exists(
                db.select({ userId: credentialPermission.userId })
                  .from(credentialPermission)
                  .where(
                    and(
                      eq(credentialPermission.credentialId, credential.id),
                      eq(credentialPermission.userId, activeUser.id),
                    ),
                  ),
              ),
            ),
          ),
        ),
    ),
    eq(file.userId, activeUser.id),
    exists(
      db.select({ id: filePermission.id })
        .from(filePermission)
        .where(
          and(
            eq(filePermission.fileId, file.id),
            or(
              eq(filePermission.userId, activeUser.id),
              eq(filePermission.email, activeUser.email),
            ),
          ),
        ),
    ),
  ),
  // Additional filters...
)
```

#### Key Patterns

1. **Tenant Scoping**: Always check `user.slug === activeUser.slug` for tenant admins
2. **Single Query**: Use `exists()` subqueries in WHERE clause for atomic operations
3. **Email Matching**: `filePermission` can match by `userId` OR `email` for users not in system
4. **Credential Inheritance**: Credential permissions cascade to associated files
5. **Admin Bypass**: Tenant admins skip permission checks but require tenant validation

#### References
- File implementation: `src/file/index.ts`
- Credential implementation: `src/credential/index.ts`, `src/credential/permission.ts`
- Helper functions: `src/utils/credential.ts` (getCredentialsForUser, getAccessTokenForUser)
