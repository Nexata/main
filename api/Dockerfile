FROM oven/bun AS build

WORKDIR /app

COPY tsconfig.json package.json bun.lock ./
RUN bun install
RUN bun pm untrusted

COPY ./src ./src
COPY ./migrations ./migrations
RUN bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
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
COPY --from=build /app/node_modules/sharp ./node_modules/sharp

ENV NODE_ENV=production
EXPOSE 8080
CMD ["./server"]
