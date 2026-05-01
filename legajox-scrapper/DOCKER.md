# Docker

This repo uses Bun and Puppeteer. The image compiles the API into a single Bun binary, then runs it on Alpine with system Chromium.

The container follows Elysia's production pattern of compiling the server with `bun build --compile`, but it does not use distroless by default because Puppeteer still needs a browser runtime and shared libraries.

## Build

```bash
docker build -t legajox-scrapper .
```

## Run

```bash
docker run --rm -p 3000:3000 \
  -e API_KEY=xd \
  -e DEFAULT_USER=your-user \
  -e DEFAULT_PASSWORD=your-password \
  legajox-scrapper
```

## Notes

- `API_KEY` is required. The server exits immediately without it.
- The app reads the listen port from the `PORT` environment variable and binds to `0.0.0.0`, so it is compatible with Cloud Run and other container platforms.
- Set `PUBLIC_URL` in deployment environments if you want `/docs` to advertise the public API origin instead of omitting server URLs from the OpenAPI spec.
- The image sets `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` so Puppeteer uses Alpine's Chromium instead of requiring Google Chrome.
- The image also sets `PUPPETEER_NO_SANDBOX=true` because many managed container runtimes, including Cloud Run, do not permit Chromium's default sandbox mode.
- `DEBUG_HEADLESS=false` requests headed mode, but that is not useful in a normal container unless you also provide a display server.
- Downloads are written under `/app/outputs`; login timeout screenshots are written under `/app/request_imitator/outputs/debug`.
