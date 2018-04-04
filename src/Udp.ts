import * as net from "net"
import * as dgram from "dgram"
import * as crypto from "crypto"
import * as events from "events"
import { AddressInfo } from "dgram"

import ConnectionManager from "./ConnectionManager"
import Utils, { IShadowsocksHeader, IShadowsocksHeaderAddressType } from "./Utils"

import SSCrypto from "./Crypto/SSCrypto"
import { ISSCryptoMethod } from "./Crypto/ISSCryptoMethod"

export default class ShadowsocksUdpProcess extends events.EventEmitter {

    private connctions: ConnectionManager<IUdpClient>;

    constructor(
        private udpServer: dgram.Socket,
        private encryptMethod: ISSCryptoMethod) {
        super();
        this.connctions = new ConnectionManager<IUdpClient>();
    }

    public onData(data: Buffer, rinfo: AddressInfo) {
        data = this.encryptMethod.decryptDataWithoutStream(data);
        var shadowsocksHeader: IShadowsocksHeader = null;
        try {
            shadowsocksHeader = Utils.parseShadowsocksHeader(data);
        } catch (error) {
            return this.emit("error", error, rinfo.address, rinfo.port);
        }
        var connectionId: string = this.getConnectionId(rinfo);
        var connection: IUdpClient = this.connctions.get(connectionId);
        if (connection == null) {
            var localSocks = dgram.createSocket("udp4");
            connection = {
                clientAddress: rinfo.address,
                clientPort: rinfo.port,
                targetAddress: shadowsocksHeader.address,
                targetPort: shadowsocksHeader.port,
                localSocks: localSocks,
                onFree: () => {
                    localSocks.removeAllListeners();
                    localSocks.close();
                    this.connctions.remove(connectionId);
                }
            }
            localSocks.on("message", function (data, rinfo) {
                this.connctions.get(connectionId);
                var header = Buffer.allocUnsafe(7);
                var ipBuffer = Utils.ipAddressToBuffer(rinfo.address);
                header[0] = 0x01;
                ipBuffer.copy(header, 1);
                header.writeUInt16BE(rinfo.port, 5);
                this.udpServer.send(
                    this.encryptMethod.encryptDataWithoutStream(Buffer.concat([header, data])),
                    connection.clientPort, connection.clientAddress
                );
            }.bind(this));

            localSocks.on("error", function(error) {
                connection.onFree();
                return this.emit("error", error, rinfo.address, rinfo.port);
            }.bind(this))

            this.connctions.add(connectionId, connection);
            this.emit("clientHanded", rinfo.address, rinfo.port, connection.targetAddress, connection.targetPort);
        }
        connection.localSocks.send(shadowsocksHeader.payloay, connection.targetPort, connection.targetAddress);
    }

    private getConnectionId(rinfo: AddressInfo): string {
        return `${rinfo.address}:${rinfo.port}`;
    }

}

interface IUdpClient {
    localSocks: dgram.Socket,
    clientAddress: string,
    clientPort: number,
    targetAddress: string,
    targetPort: number,
    onFree: Function,
}