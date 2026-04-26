FROM oven/bun:1-alpine AS build

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

FROM alpine:3.22 AS runtime

WORKDIR /app

RUN apk add --no-cache \
	chromium \
	nss \
	freetype \
	harfbuzz \
	ca-certificates \
	nodejs \
	npm \
	ttf-freefont \
	libstdc++ && \
	npm install -g typescript && \
	addgroup -S app && \
	adduser -S -G app app

COPY --from=build /app/server /app/server

RUN mkdir -p /app/outputs/_descargas_tmp /app/scripts/outputs/debug && \
	chown -R app:app /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DEBUG_HEADLESS=true
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_NO_SANDBOX=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

USER app

EXPOSE 3000

ENTRYPOINT ["/app/server"]
