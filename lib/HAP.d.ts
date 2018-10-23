export declare interface IAccessory {
    categories: ICategories;
    uuid: string;
    displayName: string;
    reachable: boolean;
    new (deviceName: string, uuid: string, type: string): any;
    addService(type: string, displayName: string): IService;
    getService(type: string): IService;
    configureCameraSource(ffmpeg: any): any;
    updateReachability(reachable: boolean): any;
}
export declare interface IHap {
    uuidgen: IUUIDGen;
    service: IService;
    characteristic: ICharacteristic;
    Accessory: any;
    StreamController: IStreamController;
}
export declare interface IUUIDGen {
    generate(text: string): string;
    unparse(text: string): string;
}
export declare interface IService {
    TemperatureSensor: string;
    LightSensor: string;
    HumiditySensor: string;
    MotionSensor: string;
    OccupancySensor: string;
    BatteryService: string;
    AccessoryInformation: string;
    CameraControl: any;
    getCharacteristic(characteristicUuid: string): ICharacteristic;
}
export declare interface IStreamController {
    service: IService;
    sessionIdentifier: string;
    new (i: any, options: any, self: any): any;
    forceStop(): any;
    handleCloseConnection(controller: IStreamController): any;
}
export declare interface ICharacteristic {
    CurrentTemperature: string;
    CurrentAmbientLightLevel: string;
    CurrentRelativeHumidity: string;
    MotionDetected: string;
    OccupancyDetected: string;
    BatteryLevel: string;
    ChargingState: string;
    StatusLowBattery: string;
    Manufacturer: string;
    Model: string;
    SerialNumber: string;
    Identify: string;
    Name: string;
    FirmwareRevision: string;
    updateValue(value: any): void;
}
export declare interface ICategories {
    CAMERA: string;
}
export declare interface ISnapshotRequest {
    width: number;
    height: number;
}
