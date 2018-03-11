const Cap = require("cap").Cap;
import * as network from "network"

import IConfig from "./IConfig"

export default class XTUdp {

    private xtimes: number = 1;

    private cap: any;
    private capBuffer: Buffer;
    private readonly speaceTtl = 0x7B;

    constructor(private config: IConfig, private logger: any) {
        if (config.xtudp != undefined && !isNaN(config.xtudp) && config.xtudp > 1) {
            this.xtimes = config.xtudp;
            this.load();
        }
    }

    private async load() {
        var defaultGateway: string = null;
        var defaultIpAddress: string = null;
        try {
            defaultGateway = await this.getDefaultGateway();
            defaultIpAddress = await this.getDefaultIp(defaultGateway);
            this.logger.info(`[XTUdp] Default gateway: ${defaultGateway}.`);
            this.logger.info(`[XTUdp] Default ip address: ${defaultIpAddress}.`);
        } catch (error) {
            this.logger.warn(`[XTUdp] Get default ip address failed: ${error}.`);
        }

        if (defaultGateway == null || defaultIpAddress == null) {
            this.logger.warn(`[XTUdp] Get default ip address failed.`);
            return;
        }

        this.cap = new Cap();
        var device = Cap.findDevice(defaultIpAddress);
        var filter = `udp and src port ${this.config.server_port}`;
        this.capBuffer = Buffer.alloc(65535);
        this.cap.open(device, filter, this.capBuffer.length, this.capBuffer);
        this.cap.setMinBytes && this.cap.setMinBytes(0);
        this.cap.on("packet", this.packet.bind(this))
    }

    private packet(nbytes: number) {
        /* Ethernet + IP/TCP */
        if (nbytes < 34) return;
        if (this.capBuffer[22] == this.speaceTtl) return;
        this.capBuffer[22] = this.speaceTtl;
        var sendingBuffer = this.capBuffer.slice(0, nbytes);
        for (var i = 1; i < this.xtimes; i++) {
            this.cap.send(sendingBuffer);
        }
    }

    private getDefaultGateway(): Promise<string> {
        return new Promise((reslove, reject) => {
            network.get_gateway_ip(function (err, ip) {
                err ? reject(err) : reslove(ip);
            });
        });
    }

    private getDefaultIp(defaultGateway: string): Promise<string> {
        return new Promise((reslove, reject) => {
            network.get_gateway_ip(function (err, ip) {
                if (err) {
                    return reject(err);
                }

                network.get_interfaces_list(function (err, list) {
                    if (err) {
                        return reject(err);
                    }
                    for (const item of list) {
                        if (item.gateway_ip == defaultGateway) {
                            return reslove(item.ip_address);
                        }
                    }
                    reslove(null);
                });
            });
        });
    }

}