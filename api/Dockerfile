FROM oven/bun:1.3.3 AS build

WORKDIR /app

COPY tsconfig.json package.json bun.lock ./
RUN bun install

COPY ./src ./src
RUN bun build \
	--compile \
	--external pdfjs-dist \
	--external sharp \
	--external file-type \
	--minify \
	--outfile server \
	src/index.ts

# SHARP FIX:
# FROM gcr.io/distroless/base
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
	libvips42 libglib2.0-0 \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

ENV NODE_ENV=production
CMD ["./server"]
