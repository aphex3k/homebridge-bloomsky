import { EventEmitter } from "events";

declare class API extends EventEmitter {
  constructor();

  public accessory(name: any): any;

  public platform(name: any): any;

  public publishCameraAccessories(pluginName: any, accessories: any): void;

  public registerAccessory(
    pluginName: any,
    accessoryName: any,
    constructor: any,
    configurationRequestHandler: any
  ): void;

  public registerPlatform(
    pluginName: any,
    platformName: any,
    constructor: any,
    dynamic: any
  ): void;

  public registerPlatformAccessories(
    pluginName: any,
    platformName: any,
    accessories: any
  ): void;

  public unregisterPlatformAccessories(
    pluginName: any,
    platformName: any,
    accessories: any
  ): void;

  public updatePlatformAccessories(accessories: any): void;
}

export default API;
