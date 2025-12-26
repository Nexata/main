FROM oven/bun AS build

WORKDIR /app
ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install

COPY ./src ./src
COPY ./migrations ./migrations
RUN bun build \
  --compile \
  --minify-whitespace \
  --minify-syntax \
  --outfile server \
  src/index.ts

FROM gcr.io/distroless/base
WORKDIR /app
COPY --from=build /app/server server
ENV NODE_ENV=production
CMD ["./server"]
EXPOSE 3000
