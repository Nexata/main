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
- The image sets `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` so Puppeteer uses Alpine's Chromium instead of requiring Google Chrome.
- `DEBUG_HEADLESS=false` requests headed mode, but that is not useful in a normal container unless you also provide a display server.
- Downloads and debug screenshots are written under `/app/outputs` and `/app/scripts/outputs/debug`.
