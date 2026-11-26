# ── Stage 1: Build Production Bundle ──
FROM node:22-alpine AS builder
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Minimal Non-Root Production Nginx Runner ──
FROM nginx:1.27-alpine AS runner

# Configure Nginx for unprivileged non-root execution with repeatable /etc/nginx/templates rendering
RUN sed -i -e '/^user /d' -e 's,/var/run/nginx.pid,/tmp/nginx.pid,' -e 's,/run/nginx.pid,/tmp/nginx.pid,' /etc/nginx/nginx.conf && \
    rm -f /etc/nginx/conf.d/default.conf && \
    mkdir -p /etc/nginx/templates /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d /etc/nginx/templates /usr/share/nginx/html

COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html
COPY --chown=nginx:nginx frontend/nginx.conf /etc/nginx/templates/default.conf.template

ENV API_UPSTREAM_URL=http://api-gateway:8000 \
    NGINX_ENVSUBST_FILTER=API_UPSTREAM_URL

USER nginx
EXPOSE 8080
