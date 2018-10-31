/// <reference types="node" />
import { FFMPEG } from "./Ffmpeg";
import { API } from "./homebridge";
import { PlatformAccessory } from "./PlatformAccessory";
import { IStation } from "./Station";
export { Bloomsky };
export default class Bloomsky {
    static Accessory: PlatformAccessory;
    static Service: HAPNodeJS.Service;
    static Characteristic: HAPNodeJS.Characteristic;
    static Hap: HAPNodeJS.HAPNodeJS;
    static UUIDGen: HAPNodeJS.uuid;
    timeout: NodeJS.Timeout | undefined;
    accessories: PlatformAccessory[];
    log: (text: string) => void;
    private apiKey;
    private apiUrl;
    private vcodec;
    private api;
    private latestData;
    private debug;
    constructor(log: (text: string) => void, config: any, api: API);
    configureAccessory(accessory: PlatformAccessory): void;
    addAccessory(station: IStation): void;
    updateAccessory(station: IStation): void;
    removeAccessory(): void;
    temporaryFilenameForStationUuid(uuid: string): string;
    getFfmpegForStationWithUuid(uuid: string): FFMPEG;
    private updateData;
    private stationNeedsToBeRegistered;
    private updateExistingAccessories;
    private registerNewAccessories;
    private updateAccessoriesReachability;
}
