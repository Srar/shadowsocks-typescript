FROM node:8

WORKDIR /usr/src/app

COPY . .

RUN apt update -y && \
    apt install libpcap* gcc g++ -y && \
    npm install --unsafe && \
    npm run build && \
    cp config.json /etc/shadowsocks.json

EXPOSE 9010
ENTRYPOINT [ "node", "build/main.js", "--config", "/etc/shadowsocks.json" ]