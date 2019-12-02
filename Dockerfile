FROM node:8.16.2-alpine

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && apk add --no-cache git

RUN npm config set registry https://registry.npm.taobao.org && npm install -g cnpm

COPY server /workspace/server
COPY static /workspace/static

RUN cd /workspace/server && cnpm install

VOLUME ['/workspace/server/config/runtime-conf.js']

EXPOSE 3334

CMD ["node", "/workspace/server/start-up.js"]
