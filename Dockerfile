FROM node:8.16.2

COPY sources.list /etc/apt/sources.list

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN npm config set registry https://registry.npm.taobao.org && npm install -g cnpm

COPY server /workspace/server
COPY static /workspace/static

RUN cd /workspace/server && cnpm install

VOLUME ['/workspace/server/config/runtime-conf.js']

EXPOSE 3334

CMD ["node", "/workspace/server/start-up.js"]
