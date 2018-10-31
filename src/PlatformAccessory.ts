import { EventEmitter } from "events";
import * as hap from "hap-nodejs";

// tslint:disable-next-line:interface-name
declare interface PlatformAccessory extends HAPNodeJS.Accessory {
    displayName: string;
    username: string;
    pincode: string;
    UUID: string;
    aid: string;
    bridged: boolean;
    bridgedAccessories: HAPNodeJS.Accessory[];
    reachable: boolean;
    category: HAPNodeJS.Accessory.Categories;
    services: HAPNodeJS.Service[];
    cameraSource: HAPNodeJS.CameraSource;
    Categories: typeof HAPNodeJS.Accessory.Categories;

    // tslint:disable-next-line:no-misused-new
    new (displayName: string, category: string): PlatformAccessory;
    // tslint:disable-next-line:unified-signatures
    new (displayName: string, uuid: string, subtype: number): PlatformAccessory;
    // tslint:disable-next-line:ban-types
    addService(service: HAPNodeJS.Service | Function): HAPNodeJS.Service;
    addService(service: HAPNodeJS.Service, displayName: string): HAPNodeJS.Service;
    // tslint:disable-next-line:unified-signatures
    // addService(category: HAPNodeJS.Accessory.Categories, displayName: string): HAPNodeJS.Service;
    removeService(service: HAPNodeJS.Service): HAPNodeJS.Service;
    // tslint:disable-next-line:unified-signatures
    removeService(service: HAPNodeJS.Service, displayName: string): HAPNodeJS.Service;
    getService(service: HAPNodeJS.Service): HAPNodeJS.Service;
    // tslint:disable-next-line:unified-signatures
    getService(name: string): HAPNodeJS.Service;
    updateReachability(reachable: boolean): void;
    addBridgedAccessory(accessory: HAPNodeJS.Accessory, deferUpdate: boolean): HAPNodeJS.Accessory;
    addBridgedAccessories(accessories: HAPNodeJS.Accessory[]): void;
    removeBridgedAccessory(accessory: HAPNodeJS.Accessory, deferUpdate: boolean): void;
    removeBridgedAccessories(accessories: HAPNodeJS.Accessory[]): void;
    getCharacteristicByIID(iid: string): HAPNodeJS.Characteristic;
    getBridgedAccessoryByAID(aid: string): HAPNodeJS.Accessory;
    findCharacteristic(aid: string, iid: string): HAPNodeJS.Accessory;
    configureCameraSource(cameraSource: HAPNodeJS.CameraSource): void;
    toHAP(opt: any): JSON;
    publish(info: HAPNodeJS.PublishInfo, allowInsecureRequest: boolean): void;
    destroy(): void;
    setupURI(): string;
}

export { PlatformAccessory };
