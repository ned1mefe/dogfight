FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/client/package*.json ./packages/client/

RUN npm install

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/client ./packages/client

RUN npm run build:shared
RUN npm run build:client

FROM nginx:alpine AS runner
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
