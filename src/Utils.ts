

export default class Utils {

    public static parseShadowsocksHeader(data: Buffer): IShadowsocksHeader {
        var header: IShadowsocksHeader = {
            address: "",
            addressLength: -1,
            port: -1,
            addressType: IShadowsocksHeaderAddressType.Unknow,
            payloay: null
        }
        if (data[0] == 0x03) {
            header.addressType = IShadowsocksHeaderAddressType.Domain
            header.addressLength = data[1] + 1;
            header.address = data.slice(2, header.addressLength + 1).toString();
        } else if (data[0] == 0x01) {
            header.addressType = IShadowsocksHeaderAddressType.IPv4;
            header.addressLength = 4;
            header.address += data[1].toString() + ".";
            header.address += data[2].toString() + ".";
            header.address += data[3].toString() + ".";
            header.address += data[4].toString();
        } else if (data[0] == 0x04) {
            header.addressType = IShadowsocksHeaderAddressType.IPv6;
            header.addressLength = 16;
            header.address += data[1].toString() + ":";
            header.address += data[2].toString() + ":";
            header.address += data[3].toString() + ":";
            header.address += data[4].toString() + ":";
            header.address += data[5].toString() + ":";
            header.address += data[6].toString() + ":";
            header.address += data[7].toString() + ":";
            header.address += data[8].toString() + ":";
            header.address += data[9].toString() + ":";
            header.address += data[10].toString() + ":";
            header.address += data[11].toString() + ":";
            header.address += data[12].toString() + ":";
            header.address += data[13].toString() + ":";
            header.address += data[14].toString() + ":";
            header.address += data[15].toString() + ":";
            header.address += data[16].toString();
        } else {
            throw new Error(`发送了未知地址类型数据包.`);
        }
        header.port = ((data[header.addressLength + 1] << 8) + data[header.addressLength + 2]);
        if (isNaN(header.port)) {
            throw new Error(`发送了未知端口数据包.`);
        }
        header.address = header.address.trim();
        header.payloay = data.slice(3 + header.addressLength);
        return header;
    }

    public static bufferToIpAddress(bufs: Buffer): string {
        return `${bufs[0].toString(10)}.${bufs[1].toString(10)}.${bufs[2].toString(10)}.${bufs[3].toString(10)}`;
    }

    public static ipAddressToBuffer(ip: string): Buffer {
        var nip = ip.split(".").map(function (item) {
            return parseInt(item);
        })
        return Buffer.from(nip);
    }
}

export interface IShadowsocksHeader {
    address: string,
    addressLength: number,
    addressType: IShadowsocksHeaderAddressType,
    port: number,
    payloay: Buffer
}

export enum IShadowsocksHeaderAddressType {
    Domain, IPv4, IPv6, Unknow
}