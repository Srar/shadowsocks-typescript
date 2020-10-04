import * as net from "net"
import * as crypto from "crypto"
import * as events from "events"

import SSCrypto from "./Crypto/SSCrypto"
import { ISSCryptoMethod } from "./Crypto/ISSCryptoMethod"

import Utils, { IShadowsocksHeader, IShadowsocksHeaderAddressType } from "./Utils"

export default class ShadowsocksTcpProcess extends events.EventEmitter {

    private readonly initTime: number = new Date().getTime();
    private firstTrafficTime: number = 0;

    private readonly clientSocket: net.Socket;
    private readonly targetSocket: net.Socket;

    private dataBuffer: Buffer = new Buffer([]);
    private isConnectTarget: boolean = false;
    private isClear: boolean = false;
    private isFirstTraffic: boolean = true;

    private remoteInfo: IShadowsocksHeader;

    private socks5HandSetup: number = 0;

    private isClientFirstPackage: boolean = true;
    private isTargetFirstPackage: boolean = true;

    constructor(private processConfig: ShadowsocksProcessConfig) {
        super();
        this.clientSocket = processConfig.clientSocket;
        this.clientSocket.setNoDelay(true);
        this.clientSocket.on("data", this.onClientSocketData.bind(this));
        this.clientSocket.on("close", this.onClientSocketClose.bind(this));
        this.clientSocket.on("error", this.onClientSocketError.bind(this));

        this.targetSocket = new net.Socket();
        this.targetSocket.setNoDelay(true);
        this.targetSocket.on("error", this.onTargetSocketError.bind(this));
    }

    private onTargetSocketConnect() {
        this.isConnectTarget = true;
        this.targetSocket.write(this.dataBuffer);
        this.clientSocket.resume();
        this.dataBuffer = null;
        this.emit("targetConnected");
        this.targetSocket.on("data", this.onTargetSocketData.bind(this));
        this.targetSocket.on("close", this.onTargetSocketClose.bind(this));
    }


    private onTargetSocketData(data: Buffer) {
        if (this.isFirstTraffic) {
            this.isFirstTraffic = false;
            /* 记录首次通讯时间 */
            this.firstTrafficTime = new Date().getTime();
            /* 触发首次通讯事件 */
            this.emit("firstTraffic", this.firstTrafficTime - this.initTime);
        }

        this.emit("targetData", data);

        if (this.isClear) return;

        data = this.processConfig.encryptMethod.encryptData(data);

        this.targetSocket.pause();

        this.clientSocket.write(data, function () {
            this.targetSocket.resume();
        }.bind(this));
    }

    private onClientSocketData(data: Buffer) {
        try {
            data = this.processConfig.encryptMethod.decryptData(data);
            if (this.isClientFirstPackage) {
                this.remoteInfo = Utils.parseShadowsocksHeader(data);
                this.emit("clientHanded", this.remoteInfo.address, this.remoteInfo.port);
                if (this.isClear) return;
                this.dataBuffer = this.remoteInfo.payloay;
                this.isClientFirstPackage = false;
                this.targetSocket.connect(this.remoteInfo.port, this.remoteInfo.address, this.onTargetSocketConnect.bind(this));
                return;
            }
        } catch (error) {
            this.clientSocket.pause();
            setTimeout(() => this.onClientSocketError(error), 1000 * 30);
            return;
        }

        this.emit("clientData", data);

        if (this.isClear) return;

        /*
            判断是否已经连接至Socks5服务器  
            -> 已连接则直接解密转发流量        
            -> 未连接则暂时存放队列            
        */
        if (this.isConnectTarget) {
            this.clientSocket.pause();
            this.targetSocket.write(data, function () {
                this.clientSocket.resume();
            }.bind(this));
        } else {
            this.dataBuffer = Buffer.concat([this.dataBuffer, data]);
        }
    }

    private onClientSocketClose() {
        this.clearConnect();
    }

    private onTargetSocketClose() {
        this.clearConnect();
    }

    private onClientSocketError(error: Error) {
        this.emit("error", error);
        this.clearConnect();
    }

    private onTargetSocketError(error: Error) {
        this.emit("error", error);
        this.clearConnect();
    }

    public getRemoteAddress(): string {
        return this.remoteInfo.address;
    }

    public getRemoteAddressType(): IShadowsocksHeaderAddressType {
        return this.remoteInfo.addressType;
    }

    public getRemotePort(): number {
        return this.remoteInfo.port;
    }

    public getClientSocket(): net.Socket {
        return this.clientSocket;
    }

    public getTargetSocket(): net.Socket {
        return this.targetSocket;
    }

    public clearConnect() {
        if (this.isClear) {
            return;
        }
        this.isClear = true;
        try {
            this.targetSocket.destroy();
        } catch (ex) { }
        try {
            this.clientSocket.destroy();
        } catch (ex) { }
        this.dataBuffer = null;
        this.emit("close");
        this.removeAllListeners();
    }
}

export interface ShadowsocksProcessConfig {
    clientSocket: net.Socket;
    encryptMethod: ISSCryptoMethod;
}