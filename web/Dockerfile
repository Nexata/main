FROM oven/bun AS build

WORKDIR /app/web
COPY package.json bun.lock ./
RUN mkdir -p /app/api/src && echo 'export type App = any;' > /app/api/src/index.ts
RUN bun install && ln -s /app/web/node_modules /app/node_modules

COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts index.html components.json ./
COPY project.inlang/ project.inlang/
COPY messages/ messages/
COPY public/ public/
COPY src/ src/

ARG VITE_API_URL
ARG VITE_FRONT_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_FRONT_URL=$VITE_FRONT_URL

# Type check: RUN bun tsc -b
RUN bun run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]
