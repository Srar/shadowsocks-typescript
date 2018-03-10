import * as fs from "fs"
import * as net from "net"
import * as dgram from "dgram"

const logger = require("tracer").console({
    format: [
        "{{timestamp}} <{{title}}> {{message}}",
    ]
});

import IConfig from "./IConfig"
import SSCrypto from "./Crypto/SSCrypto"
import { ISSCryptoMethod } from "./Crypto/ISSCryptoMethod"
import ShadowsocksTcpProcess, { ShadowsocksProcessConfig } from "./Tcp"
import ShadowsocksUdpProcess from "./Udp";

const argv = require("optimist")
    .usage("Usage: $0 --config [config file]")
    .demand(["config"])
    .argv;

const config: IConfig = JSON.parse(fs.readFileSync(argv.config).toString());

/* TCP Process Start */
const shadowsocksTcpServer: net.Server = net.createServer(function (connection) {
    var address = connection.address();
    var clientIp: string = address.address;
    var clientPort: number = address.port;

    var encryptMethod: ISSCryptoMethod = null;
    try {
        encryptMethod = SSCrypto.createCryptoMethodObject(config.method, config.password);
    } catch (error) {
        this.emit("error", error);
        return connection.destroy();
    }

    var process: ShadowsocksTcpProcess = new ShadowsocksTcpProcess({ clientSocket: connection, encryptMethod: encryptMethod });
    process.on("clientHanded", function (targetAddress, targetPort) {
        logger.info(`[TCP] ${clientIp}:${clientPort} <--> ${targetAddress}:${targetPort}`);
    });

    process.on("error", function (err) {
        logger.warn(`[TCP] ${clientIp}:${clientPort}`, err.message);
    });
});
/* TCP Process End */

/* UDP Process Start */
const shadowsocksUdpServer: dgram.Socket = dgram.createSocket("udp4");
const shadowsocksUdpProcess: ShadowsocksUdpProcess = new ShadowsocksUdpProcess(
    shadowsocksUdpServer,
    SSCrypto.createCryptoMethodObject(config.method, config.password)
);
shadowsocksUdpServer.on("message", function (data, rinfo) {
    shadowsocksUdpProcess.onData.call(shadowsocksUdpProcess, data, rinfo);
});
shadowsocksUdpProcess.on("clientHanded", function (clientAddress, clientPort, targetAddress, targetPort) {
    logger.info(`[UDP] ${clientAddress}:${clientPort} <--> ${targetAddress}:${targetPort}`);
})
shadowsocksUdpProcess.on("error", function (err, address, port) {
    logger.warn(`[TCP] ${address}:${port}`, err.message);
});
/* UDP Process End */

shadowsocksUdpServer.bind(
    (config.server_port || 1080),
    (config.server || "0.0.0.0"),
    function () {
        var address = shadowsocksUdpServer.address();
        logger.info(`[UDP] Shadowsocks server listening at ${address.address}:${address.port}.`);
    }
);
shadowsocksTcpServer.listen(
    (config.server_port || 1080),
    (config.server || "0.0.0.0"),
    function () {
        var address = shadowsocksTcpServer.address();
        logger.info(`[TCP] Shadowsocks server listening at ${address.address}:${address.port}.`);
    }
);