# Anlagenbuch-Server: App + zentrale Datenhaltung
FROM node:22-alpine
WORKDIR /app
COPY index.html styles.css manifest.webmanifest sw.js ./
COPY js ./js
COPY vendor ./vendor
COPY icons ./icons
COPY server/server.js ./server/server.js
RUN mkdir -p /data && chown node:node /data
ENV PORT=8080 DATA_DIR=/data NODE_ENV=production
VOLUME /data
EXPOSE 8080
USER node
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1
CMD ["node", "server/server.js"]
