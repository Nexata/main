# Nexata

Nexata is a Bun monorepo for an AI workspace assistant. It includes a React web app, an Elysia API, and an optional Puppeteer-based Legajox scraper service.

The app connects to enterprise data sources, ingests files and dynamic content, and exposes a chat interface that can search and act across connected sources with tenant-aware permissions.

## Stack

| Area | Technology |
| --- | --- |
| Runtime | Bun |
| API | Elysia, TypeBox, Drizzle ORM, Neon HTTP, Upstash Redis |
| Web | React, Vite, TanStack Router, TanStack Query, Tailwind CSS v4, shadcn/ui |
| AI | Vercel AI SDK, Novita OpenAI-compatible models, vector embeddings |
| Storage | S3-compatible object storage, MinIO for local Docker preview |
| Integrations | Google, Microsoft, Dropbox, Mercado Pago, Legajox |
| Tooling | Biome, TypeScript, Docker Compose |

## Repository Layout

```text
.
|-- api/                 # Main Elysia API and database schema
|-- web/                 # Vite React frontend
|-- legajox-scrapper/    # Optional Legajox scraper API and CLIs
|-- docker-compose.yml   # Local preview stack
|-- package.json         # Root workspace scripts
`-- bun.lock             # Root lockfile
```

## Requirements

- Bun 1.3+
- Docker and Docker Compose for local infrastructure or full preview
- PostgreSQL-compatible database, Redis HTTP endpoint, and S3-compatible storage when not using Docker Compose
- Google Chrome if running the Legajox scraper locally outside Docker

## Quick Start

Install dependencies from the repository root:

```bash
bun install
```

Create a root `.env` file for Docker Compose or API development. At minimum, local Compose needs the API variables listed below.

```bash
NODE_ENV=development
PORT=3000
NEXATA_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgres://nexata:nexata@postgres:5432/nexata
UPSTASH_REDIS_REST_URL=http://serverless-redis-http:80
UPSTASH_REDIS_REST_TOKEN=local_dev_token
NOVITA_API_KEY=replace-me
SMTP_HOST=replace-me
SMTP_USERNAME=replace-me
SMTP_PASSWORD=replace-me
DEPLOYMENT_URL=http://localhost:3000
DEFAULT_REDIRECT_URL=http://localhost:5173/chat
S3_ACCESS_URL=http://localhost:9000/nexata
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=nexata
S3_REGION=us-east-1
```

Start the local Docker preview stack:

```bash
bun run preview
```

The preview exposes:

| Service | URL |
| --- | --- |
| Web app | `http://localhost:8080` |
| API | `http://localhost:3000` |
| API docs | `http://localhost:3000/docs` |
| PostgreSQL | `localhost:5432` |
| Neon HTTP proxy | `http://localhost:4444` |
| Redis HTTP proxy | `http://localhost:8079` |
| Redis Insight | `http://localhost:5540` |
| MinIO API | `http://localhost:9000` |
| MinIO console | `http://localhost:9001` |

## Local Development

Start only the backing services with Docker Compose if you want to run the API and web app directly with Bun:

```bash
docker compose up postgres neon-proxy redis serverless-redis-http minio minio-init
```

For direct local API execution, use localhost service URLs in `api/.env` or your shell:

```bash
DATABASE_URL=postgres://nexata:nexata@localhost:5432/nexata
NEON_PROXY_URL=http://localhost:4444
UPSTASH_REDIS_REST_URL=http://localhost:8079
UPSTASH_REDIS_REST_TOKEN=local_dev_token
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_URL=http://localhost:9000/nexata
```

Run both main apps from the repository root:

```bash
bun run dev
```

Run them separately when needed:

```bash
bun run api:dev
bun run web:dev
```

The web development server reads `web/.env.development` and defaults to:

```bash
VITE_API_URL=http://localhost:3000
VITE_FRONT_URL=http://localhost:5173
```

## Scripts

Root scripts:

| Command | Description |
| --- | --- |
| `bun run dev` | Starts API and web development servers concurrently |
| `bun run api:dev` | Starts the API with watch mode |
| `bun run web:dev` | Starts the Vite development server |
| `bun run check` | Runs Biome with fixes across the repository |
| `bun run preview` | Builds and starts the Docker Compose preview stack |

API scripts, from `api/`:

| Command | Description |
| --- | --- |
| `bun run dev` | Starts the API in watch mode |
| `bun run mig` | Generates Drizzle migrations |
| `bun run mig:push` | Applies Drizzle migrations |
| `bun run reembed:chunks` | Re-embeds stored file chunks |
| `bun run check` | Runs Biome with fixes for the API package |

Web scripts, from `web/`:

| Command | Description |
| --- | --- |
| `bun run dev` | Starts Vite |
| `bun run build` | Builds the production frontend |
| `bun run preview` | Previews the production frontend locally |

Legajox scraper scripts, from `legajox-scrapper/`:

| Command | Description |
| --- | --- |
| `bun run api` | Starts the scraper API |
| `bun run test` | Runs the Bun test suite |
| `bun run validate <user> <password>` | Validates Legajox credentials |
| `bun run user-info` | Scrapes general user information |
| `bun run employees` | Scrapes employees |
| `bun run org-chart` | Scrapes the organization chart |
| `bun run liquidaciones` | Scrapes pending actions |
| `bun run ausencias` | Scrapes absences |
| `bun run vacaciones` | Scrapes vacation days |
| `bun run documentos:list-dirs` | Lists document directories |
| `bun run documentos:list-docs` | Lists documents |
| `bun run documentos:download` | Downloads documents |
| `bun run documentos:search` | Searches documents |

## Environment Variables

The API validates required environment variables at runtime. Common variables include:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Production/development mode switch |
| `PORT` | API listen port |
| `NEXATA_SECRET` | Application secret for tokens and signed state |
| `DATABASE_URL` | PostgreSQL connection string used by Neon HTTP client and Drizzle |
| `NEON_PROXY_URL` | Local Neon HTTP proxy URL for development |
| `UPSTASH_REDIS_REST_URL` | Redis HTTP endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Redis HTTP token |
| `NOVITA_API_KEY` | OpenAI-compatible model provider key |
| `SMTP_HOST` | SMTP host for transactional email |
| `SMTP_PORT` | SMTP port, defaults to `587` |
| `SMTP_USERNAME` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `DEPLOYMENT_URL` | Public API URL used for OAuth and payment callbacks |
| `DEFAULT_REDIRECT_URL` | Default frontend redirect after payment/backoffice flows |
| `S3_ACCESS_URL` | Public base URL for uploaded files |
| `S3_ENDPOINT` | S3-compatible API endpoint for Bun's S3 client |
| `S3_ACCESS_KEY_ID` | S3 access key |
| `S3_SECRET_ACCESS_KEY` | S3 secret key |
| `S3_BUCKET` | S3 bucket name |
| `S3_REGION` | S3 region |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth client secret |
| `MICROSOFT_TENANT_ID` | Microsoft tenant, defaults to `common` |
| `DROPBOX_APP_KEY` | Dropbox app key |
| `DROPBOX_APP_SECRET` | Dropbox app secret |
| `MP_ACCESS_TOKEN` | Mercado Pago access token |
| `MP_WEBHOOK_KEY` | Mercado Pago webhook signing key |
| `LEGAJOX_API_URL` | Optional Legajox scraper API URL |
| `LEGAJOX_API_KEY` | Optional Legajox scraper API key |
| `LEGAJOX_ALLOWED_SLUGS` | Comma-separated tenant slugs allowed to use Legajox |

Frontend variables must use the `VITE_` prefix:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL used by the web client |
| `VITE_FRONT_URL` | Public frontend URL used for OAuth callbacks |
| `VITE_SENTRY_DSN` | Optional Sentry DSN |
| `VITE_LEGAJOX_ALLOWED_SLUGS` | Optional comma-separated tenant slugs for Legajox UI access |

## Database

The API uses Drizzle ORM with PostgreSQL and migration files in `api/migrations/`.

Generate migrations after schema changes:

```bash
cd api
bun run mig
```

Apply migrations:

```bash
cd api
bun run mig:push
```

## Integrations

Nexata supports OAuth login and credential linking for Google, Microsoft, and Dropbox. Dynamic sources include Gmail, Google Calendar, Outlook, and Outlook Calendar. Storage sources include Google Drive, Dropbox, OneDrive, and optionally Legajox documents.

The Legajox scraper can run as a separate API:

```bash
cd legajox-scrapper
cp .env.example .env
API_KEY=xd DEFAULT_USER=your-user DEFAULT_PASSWORD=your-password bun run api
```

It can also be run with Docker:

```bash
cd legajox-scrapper
docker build -t legajox-scrapper .
docker run --rm -p 3000:3000 \
  -e API_KEY=xd \
  -e DEFAULT_USER=your-user \
  -e DEFAULT_PASSWORD=your-password \
  legajox-scrapper
```

## Verification

Run checks before opening a change:

```bash
bun run check
cd web && bun tsc -b && bun run build
cd ../api && bun tsc
```

There is no root test suite configured. The Legajox package has a Bun test suite, but its API tests are live integration tests that require the scraper API, credentials, and matching `API_KEY` values.

## License

This project is licensed under the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International license. See `LICENSE` for details.

## Contributing

External contributions are not currently accepted. See `CONTRIBUTING.md`.
