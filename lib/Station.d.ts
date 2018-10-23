/// <reference types="node" />
import { URL } from "url";
export declare interface IStation {
    DeviceID: string;
    DeviceName: string;
    Data: IStationData;
}
export declare interface IStationData {
    Temperature: number;
    Luminance: number;
    Humidity: number;
    Rain: boolean;
    Night: boolean;
    Voltage: number;
    DeviceType: string;
    ImageURL: URL;
}
