FROM oven/bun AS build

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=1

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--outfile server \
	src/index.ts

FROM debian:bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update && \
	apt-get install -y --no-install-recommends \
		ca-certificates \
		chromium \
		fonts-liberation \
		libnss3 && \
	rm -rf /var/lib/apt/lists/* && \
	groupadd --system app && \
	useradd --system --gid app --home-dir /app app

COPY --from=build /app/server /app/server

RUN mkdir -p /app/outputs/_descargas_tmp /app/scripts/outputs/debug && \
	chown -R app:app /app

ENV NODE_ENV=production
ENV PORT=8080
ENV DEBUG_HEADLESS=true
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_NO_SANDBOX=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

USER app

EXPOSE 8080

ENTRYPOINT ["/app/server"]
