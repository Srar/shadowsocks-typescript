import * as fs from "fs"
import * as net from "net"

const logger = require("tracer").console({
    format: [
        "{{timestamp}} <{{title}}> {{message}}",
    ]
});

import IConfig from "./IConfig"
import SSCrypto from "./Crypto/SSCrypto"
import { ISSCryptoMethod } from "./Crypto/ISSCryptoMethod"
import ShadowsocksTcpProcess, { ShadowsocksProcessConfig } from "./Tcp"

const argv = require("optimist")
    .usage("Usage: $0 --config [config file]")
    .demand(["config"])
    .argv;

const config: IConfig = JSON.parse(fs.readFileSync(argv.config).toString());

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
        logger.info(`${clientIp}:${clientPort} <--> ${targetAddress}:${targetPort}`);
    });

    process.on("error", function (err) {
        logger.warn(`${clientIp}:${clientPort}`, err.message);
    });
});
shadowsocksTcpServer.listen(
    (config.server_port || 1080),
    (config.server || "0.0.0.0"),
    function () {
        var address = shadowsocksTcpServer.address();
        logger.info(`Shadowsocks server listening at ${address.address}:${address.port}.`);
    }
);