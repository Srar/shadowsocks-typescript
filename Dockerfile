FROM node:8

WORKDIR /usr/src/app

COPY . .

RUN apt update&& \
    apt install libpcap* gcc g++ net-tools -y && \
    npm install --unsafe && \
    npm run build && \
    cp config.json /etc/shadowsocks.json

EXPOSE 9010
ENTRYPOINT [ "node", "build/main.js", "--config", "/etc/shadowsocks.json" ]