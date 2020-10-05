
### How to use
```shell
git clone https://github.com/Srar/shadowsocks-typescript.git

cd shadowsocks-typescript/

docker build -t srar/shadowsocks .

docker run -d -p 9010:9010/tcp -p 9010:9010/udp -v $(pwd)/config.json:/etc/shadowsocks.json srar/shadowsocks
```
