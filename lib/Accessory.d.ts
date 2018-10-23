import { Service, Categories } from './HAP';
export declare interface Accessory {
    categories: Categories;
    uuid: string;
    displayName: string;
    reachable: boolean;
    constructor(deviceName: string, uuid: string, type: string): any;
    addService(type: string, displayName: string): Service;
    getService(type: string): Service;
    configureCameraSource(ffmpeg: any): any;
    updateReachability(reachable: boolean): any;
}
