# AGENTS.md

This document provides guidelines for agentic coding assistants working in this repository.

## Project Overview

Nexata is an enterprise-grade AI chatbot platform built with:
- **Backend**: Bun, Elysia (web framework), Drizzle ORM, PostgreSQL, Redis
- **Frontend**: React 19, TanStack Router, TailwindCSS v4, Base UI, Shadcn-like components
- **AI**: Vercel AI SDK with multiple model providers (Groq, Deepinfra)

Repository structure:
- `/api` - Backend API (Elysia server)
- `/web` - Frontend application (Vite + React)
- `/` - Root workspace with shared tooling

## Build Commands

### Root Workspace
```bash
bun run check              # Run biome linter/formatter on entire repo
bun run dev                # Run api:dev and web:dev concurrently
```

### API (Backend)
```bash
cd api && bun run dev      # Start API server with hot reload
cd api && bun run mig      # Generate Drizzle migrations
cd api && bun run mig:push # Push migrations to database
cd api && bun run check    # Run biome on API only
```

### Web (Frontend)
```bash
cd web && bun run dev      # Start Vite dev server
cd web && bun run build    # Build for production
cd web && bun run preview  # Preview production build
```

### All Commands
```bash
bun run api:dev            # API only with hot reload
bun run web:dev            # Web only with hot reload
```

## Code Style

### Formatting & Linting
- **Tool**: Biome (configured in `biome.json`)
- **Indentation**: Tabs
- **Quotes**: Single quotes (`'`) in JavaScript/TypeScript
- **Line endings**: Unix (LF)
- **Run formatter**: `bun run check` (includes `--fix`)

### TypeScript
- **Strict mode**: Enabled
- **Module resolution**: Bundler
- **JSX**: react-jsx
- **NoUnusedLocals/Parameters**: Disabled (permissive)
- Always use explicit types for function parameters and return types
- Use `noUncheckedIndexedAccess: true` pattern (arrays/index access may be undefined)

### Imports
Order imports in this sequence:
1. External packages (e.g., `elysia`, `drizzle-orm`)
2. Internal API imports (e.g., `@api/env`, `@api/schema`)
3. Internal web imports (e.g., `@/lib/utils`)

```typescript
import { something } from 'external-package';
import { something } from '@api/module';
import { cn } from '@/lib/utils';
```

Path aliases:
- `@api/*` maps to `api/src/*`
- `@/*` maps to `web/src/*`

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Variables/functions | camelCase | `getAccessToken`, `cacheKey` |
| Constants | SCREAMING_SNAKE_CASE | `MODEL`, `PRICING` |
| Types/interfaces | PascalCase | `User`, `ChatOptions` |
| Components | PascalCase | `Button`, `ChatMessage` |
| Database schemas | camelCase | `user`, `message`, `thread` |
| Database columns | snake_case | `created_at`, `user_id` |
| Files | kebab-case | `chat-message.tsx`, `use-audio-recording.ts` |

### Code Comments
- **DO NOT add comments** unless explicitly requested by the user
- Do not explain code in comments - let code speak for itself
- Remove unused code instead of commenting it out

### Error Handling
- **API routes**: Use `HttpError` from `elysia-logger` for HTTP errors
  ```typescript
  throw HttpError.NotFound('THREAD_NOT_FOUND')
  throw HttpError.InternalServerError('NO_MESSAGE_COUNT')
  ```
- **Business logic**: Throw `new Error('DESCRIPTION')` for non-HTTP errors
- Always handle async operations with try/catch where appropriate
- Use `.catch()` on database/cache operations for specific error recovery

### Database (Drizzle ORM)
- Use `snake_case` for column names in schema definitions
- Use `camelCase` for schema table/variable names
- Use helper functions: `sq()` for subqueries, `lowerEq()` for case-insensitive comparisons
- Always use `drizzle-typebox` with `t.*` validators for API request validation
- Use `Nullish()` wrapper for optional fields in request schemas

```typescript
import { eq, and, or } from 'drizzle-orm';

// Query pattern
const result = await db
  .select({ id: user.id, email: user.email })
  .from(user)
  .where(and(eq(user.slug, slug), eq(user.email, email)))
  .limit(1)
  .at(0); // Safe access to first element
```

### API Routes (Elysia)
- Use `t.Object()` with `Nullish()` for request body validation
- Use `tObject()` helper (from `@api/utils/type`) to enforce `additionalProperties: false`
- Attach `{ detail: { summary: '...', tags: ['Tag'] } }` to all endpoints
- Use auth plugins via `.use(authPlugin())`

```typescript
export const moduleRouter = new Elysia({ prefix: '/module', tags: ['Module'] })
  .use(authPlugin())
  .get('/', async ({ activeUser }) => {
    return { data: activeUser };
  }, {
    detail: { summary: 'Get module data' },
    response: tObject({ data: t.String() })
  });
```

### React Components
- Use Base UI primitives (`@base-ui/react`) as foundation
- Use CVA (class-variance-authority) for component variants
- Use TailwindCSS v4 for styling
- Use `cn()` utility (`@/lib/utils`) to merge tailwind classes
- Use TanStack Router file-based routing with `route.tsx` pattern
- Export route definition at bottom of file

```typescript
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva('...classes...', {
  variants: {
    variant: { default: '...', destructive: '...' },
    size: { default: '...', sm: '...' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
```

### Hooks (React)
- Custom hooks in `/web/src/hooks/` directory
- Prefix with `use-` (e.g., `useAudioRecording`, `useAutosizeTextarea`)
- Return tuple for stateful values (like standard React hooks)

### Generated Files
- **Exclude from biome**: `*.gen.ts`, `migrations/*`, `components/**/*.tsx`, `hooks/**/*.ts`
- These files are auto-generated and should not be manually edited
- `routeTree.gen.ts` is generated by TanStack Router - do not edit

### Environment Variables
- Use `requireEnv()` from `@api/utils/env` to get required env vars
- Use `process.env` for optional variables with defaults
- Never commit `.env` files - use `.env` for templates only

```typescript
import { requireEnv } from '@api/utils/env';

export const API_KEY = requireEnv('API_KEY');
export const PORT = process.env.PORT ?? 3000;
```

### AI/Chat Features
- Use `streamText()` from `ai` SDK for chat responses
- Use Vercel AI SDK's `ModelMessage` type for message structures
- System prompts use template literals with `JSON.stringify(requestInfo)`
- Models configured with fallback chains for reliability

## File Organization

### API Structure
```
api/src/
  ├── index.ts              # App entrypoint, route registration
  ├── admin/                # Admin-only routes
  ├── auth/                 # Authentication (Google, Dropbox OAuth)
  ├── backoffice/           # Tenant management routes
  ├── chat/                 # Chat endpoints, threads, tools
  ├── credential/           # OAuth credentials management
  ├── file/                 # File upload/processing (PDF, text, images)
  ├── integration/          # Third-party integrations
  ├── schema/               # Drizzle schemas
  ├── user/                 # User profile routes
  └── utils/                # Helpers (auth, env, sql, type)
```

### Web Structure
```
web/src/
  ├── components/
  │   ├── ui/               # Base UI components (shadcn-like)
  │   ├── sidebar/          # Layout components
  │   └── ...               # Feature components
  ├── hooks/                # Custom React hooks
  ├── routes/               # TanStack Router routes
  │   ├── _private/         # Authenticated routes
  │   └── _public/          # Public routes
  ├── lib/                  # Utilities, API client, auth helpers
  └── main.tsx              # App entrypoint
```

## Common Patterns

### Async Operation with Caching
```typescript
const cached = await cache.get<Type>(key);
if (cached) return cached;

const result = await db.query();
await cache.set(key, result, { ex: 300 });
return result;
```

### Safe Array Access
```typescript
const item = (await db.select().from(table).limit(1)).at(0);
if (!item) throw HttpError.NotFound('NOT_FOUND');
```

### Conditional Module Usage
```typescript
.use(
  IS_PRODUCTION &&
    sentry({ environment: 'production' })
)
```

## Testing
No test framework is currently configured. If adding tests:
- Use Bun's built-in test runner: `bun test`
- Place tests alongside source files with `.test.ts` suffix
- Mock database/cache layers appropriately
