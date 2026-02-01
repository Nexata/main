FROM oven/bun AS build

WORKDIR /app

COPY tsconfig.json package.json bun.lock ./
RUN bun install
RUN bun pm untrusted

COPY ./src ./src
COPY ./migrations ./migrations
RUN bun build \
	--compile \
	--external sharp \
	--minify-whitespace \
	--minify-syntax \
	--outfile server \
	src/index.ts

# FROM gcr.io/distroless/base
FROM alpine
WORKDIR /app
COPY --from=build /app/server .

# SHARP FIX @ALPINE
RUN apk add --no-cache libc6-compat vips-cpp
COPY --from=build /app/node_modules/sharp ./node_modules/sharp

ENV NODE_ENV=production
EXPOSE ${PORT:-8080}
CMD ["./server"]
