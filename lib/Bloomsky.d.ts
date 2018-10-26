/// <reference types="node" />
import { IApi } from "./Api";
import { IAccessory, ICharacteristic, IHap, IService, IUUIDGen } from "./HAP";
import { IStation } from "./Station";
export { Bloomsky };
export default class Bloomsky {
    static Accessory: any;
    static Service: IService;
    static Characteristic: ICharacteristic;
    static Hap: IHap;
    static UUIDGen: IUUIDGen;
    timeout: NodeJS.Timeout | undefined;
    log: (text: string) => void;
    private accessories;
    private apiKey;
    private apiUrl;
    private useIntl;
    private vcodec;
    private api;
    private latestData;
    private latestResponse;
    private debug;
    constructor(log: (text: string) => void, config: any, api: IApi);
    configureAccessory(accessory: IAccessory): void;
    addAccessory(station: IStation): void;
    updateAccessory(station: IStation): void;
    removeAccessory(): void;
    private updateData;
    private stationNeedsToBeRegistered;
    private updateExistingAccessories;
    private registerNewAccessories;
    private updateAccessoriesReachability;
}
