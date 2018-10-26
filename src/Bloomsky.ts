import * as fs from "fs";
import * as http from "http";
import { Client } from "node-rest-client";
import * as url from "url";
import { IApi } from "./Api";
import { FFMPEG } from "./Ffmpeg";
import { IAccessory, ICharacteristic, IHap, IService, IUUIDGen } from "./HAP";
import { IStation } from "./Station";

export { Bloomsky };

export default class Bloomsky {

  public static Accessory: any;
  public static Service: IService;
  public static Characteristic: ICharacteristic;
  public static Hap: IHap;
  public static UUIDGen: IUUIDGen;

  public timeout: NodeJS.Timeout | undefined;

  public log: (text: string) => void;

  private accessories: IAccessory[];
  private apiKey: string;
  private apiUrl: url.UrlWithStringQuery;
  private useIntl: boolean;
  private vcodec: string;
  private api: any;
  private latestData: IStation[];
  private latestResponse: any;
  private debug: boolean;

  // Platform constructor
  // config may be null
  // api may be null if launched from old homebridge version
  constructor(log: (text: string) => void, config: any, api: IApi) {

    if (Bloomsky.Accessory === undefined) { throw Error("Accessory undefined"); }
    if (Bloomsky.Service === undefined) { throw Error("Service undefined"); }
    if (Bloomsky.Characteristic === undefined) { throw Error("Characteristic undefined"); }
    if (Bloomsky.Hap === undefined) { throw Error("Hap undefined"); }
    if (Bloomsky.UUIDGen === undefined) { throw Error("UUIDGen undefined"); }

    this.log = log;
    this.accessories = [] as IAccessory[];
    this.apiKey = config.apiKey;
    this.apiUrl = url.parse(config.apiUrl) || url.parse("https://api.bloomsky.com/api/skydata/");
    this.useIntl = config.useIntl || false;
    this.vcodec = config.vcodec || "libx264";
    this.latestData = [] as IStation[];
    this.debug = config.debug;

    this.log("Bloomsky Init");

    const platform = this;

    if (api) {
        // Save the API object as plugin needs to register new accessory via this object
        platform.api = api;

        // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
        // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
        // Or start discover new accessories.

        platform.api.on("didFinishLaunching", function() {
          platform.log("didFinishLaunching");

          platform.removeAccessory();
          platform.updateData();

        }.bind(this));

    } else {
      throw Error("Value for API expected...");
    }
  }

  // Function invoked when homebridge tries to restore cached accessory.
  // Developer can configure accessory here (like setup event handler).
  // Update current value.
  public configureAccessory(accessory: IAccessory) {
    this.log(accessory.displayName + " Configure Accessory");
    const platform = this;

    // Set the accessory to reachable if plugin can currently process the accessory,
    // otherwise set to false and update the reachability later by invoking
    // accessory.updateReachability()

    if (this.latestData != null && this.latestData.length > 0) {
      const stations = platform.latestData
        .filter((station) => accessory.UUID === Bloomsky.UUIDGen.generate(station.DeviceID));

      accessory.reachable = stations.length === 1 && stations[0] !== undefined;

      if (accessory.reachable) {
        this.updateAccessory(stations[0]);
      }
    } else {
      accessory.reachable = false;
    }

    this.accessories.push(accessory);
  }

  // add accessory dynamically from outside event
  public addAccessory(station: IStation) {
    if (this.debug) { this.log("Add Accessory: " + station.DeviceID); }
    const platform = this;
    const uuid = Bloomsky.UUIDGen.generate(station.DeviceID);
    const filename = station.DeviceID + ".jpg";

    const newAccessory = new Bloomsky.Accessory(station.DeviceName, uuid, Bloomsky.Hap.Accessory.Categories.CAMERA);
    newAccessory.configureCameraSource(
      new FFMPEG(Bloomsky.UUIDGen, Bloomsky.Service, Bloomsky.Hap.StreamController, {
        name: station.DeviceName,
        videoConfig: {
          debug : this.debug,
          maxHeight: 640,
          maxStreams: 2,
          maxWidth: 640,
          source: "-loop 1 -i " + filename,
          stillImageSource: "-loop 1 -i " + filename,
          vcodec : platform.vcodec,
        },
    }, this.log, "ffmpeg"));

    newAccessory.addService(Bloomsky.Service.TemperatureSensor, "Temperature")
    .getCharacteristic(Bloomsky.Characteristic.CurrentTemperature).updateValue(station.Data.Temperature);

    newAccessory.addService(Bloomsky.Service.LightSensor, "Luminance")
    .getCharacteristic(Bloomsky.Characteristic.CurrentAmbientLightLevel).updateValue(station.Data.Luminance);

    newAccessory.addService(Bloomsky.Service.HumiditySensor, "Humidity")
    .getCharacteristic(Bloomsky.Characteristic.CurrentRelativeHumidity).updateValue(station.Data.Humidity);

    newAccessory.addService(Bloomsky.Service.MotionSensor, "Rain")
    .getCharacteristic(Bloomsky.Characteristic.MotionDetected).updateValue(station.Data.Rain);

    newAccessory.addService(Bloomsky.Service.OccupancySensor, "Night")
    .getCharacteristic(Bloomsky.Characteristic.OccupancyDetected).updateValue(station.Data.Night);

    // I only have a Sky 1 model so I can only make a guess about the battery level
    // for this specific model.
    if (station.Data.DeviceType === "SKY1") {
        // clamp battery level between 0 and 100
        const batteryLevel = Math.max(0, Math.min(100, (100 / 2600) * station.Data.Voltage));

        const batteryService = newAccessory.addService(Bloomsky.Service.BatteryService, "Battery");
        batteryService.getCharacteristic(Bloomsky.Characteristic.BatteryLevel).updateValue(batteryLevel);
        batteryService.getCharacteristic(Bloomsky.Characteristic.ChargingState).updateValue(2);
        batteryService.getCharacteristic(Bloomsky.Characteristic.StatusLowBattery).updateValue(batteryLevel < 20);
    }

    let informationService = newAccessory.getService(Bloomsky.Service.AccessoryInformation);

    if (!informationService) {
        informationService = newAccessory.addService(Bloomsky.Service.AccessoryInformation, station.DeviceName);
    }
    informationService.getCharacteristic(Bloomsky.Characteristic.Manufacturer).updateValue("Bloomsky");
    informationService.getCharacteristic(Bloomsky.Characteristic.Model).updateValue( station.Data.DeviceType);
    informationService.getCharacteristic(Bloomsky.Characteristic.SerialNumber).updateValue(station.DeviceID);
    informationService.getCharacteristic(Bloomsky.Characteristic.Identify).updateValue(false);
    informationService.getCharacteristic(Bloomsky.Characteristic.Name).updateValue(station.DeviceName);
    informationService.getCharacteristic(Bloomsky.Characteristic.FirmwareRevision).updateValue(station.Data.DeviceType);

    this.accessories.push(newAccessory);
    this.api.registerPlatformAccessories("homebridge-bloomsky", "Bloomsky", this.accessories);

    const file = fs.createWriteStream(filename);
    file.on("finish", function() {
      file.close();
    });
    const request = http.get(station.Data.ImageURL, function(response) {
      response.pipe(file);
      if (platform.debug) { platform.log("temporary file written"); }
    });
  }

  // add accessory dynamically from outside event
  public updateAccessory(station: IStation) {
    if (this.debug) { this.log("Update Accessory"); }

    const platform = this;
    const filename = station.DeviceID + ".jpg";
    const stationUuid = Bloomsky.UUIDGen.generate(station.DeviceID);
    const accessory = platform.accessories
    .filter((anyAccessory) => anyAccessory.UUID === stationUuid)[0];

    accessory.getService(Bloomsky.Service.TemperatureSensor)
    .getCharacteristic(Bloomsky.Characteristic.CurrentTemperature).updateValue(station.Data.Temperature);

    accessory.getService(Bloomsky.Service.LightSensor)
    .getCharacteristic(Bloomsky.Characteristic.CurrentAmbientLightLevel).updateValue(station.Data.Luminance);

    accessory.getService(Bloomsky.Service.HumiditySensor)
    .getCharacteristic(Bloomsky.Characteristic.CurrentRelativeHumidity).updateValue(station.Data.Humidity);

    accessory.getService(Bloomsky.Service.MotionSensor)
    .getCharacteristic(Bloomsky.Characteristic.MotionDetected).updateValue(station.Data.Rain);

    accessory.getService(Bloomsky.Service.OccupancySensor)
    .getCharacteristic(Bloomsky.Characteristic.OccupancyDetected).updateValue(station.Data.Night);

    const informationService = accessory.getService(Bloomsky.Service.AccessoryInformation);
    informationService.getCharacteristic(Bloomsky.Characteristic.Manufacturer).updateValue("Bloomsky");
    informationService.getCharacteristic(Bloomsky.Characteristic.Model).updateValue( station.Data.DeviceType);
    informationService.getCharacteristic(Bloomsky.Characteristic.SerialNumber).updateValue(station.DeviceID);
    informationService.getCharacteristic(Bloomsky.Characteristic.Identify).updateValue(false);
    informationService.getCharacteristic(Bloomsky.Characteristic.Name).updateValue(station.DeviceName);
    informationService.getCharacteristic(Bloomsky.Characteristic.FirmwareRevision).updateValue(station.Data.DeviceType);

    // I only have a Sky 1 model so I can only make a guess about the battery level
    // for this specific model.
    if (station.Data.DeviceType === "SKY1") {
        // clamp battery level between 0 and 100
        const batteryLevel = Math.max(0, Math.min(100, (100 / 2600) * station.Data.Voltage));

        const batteryService = accessory.getService(Bloomsky.Service.BatteryService);
        batteryService.getCharacteristic(Bloomsky.Characteristic.BatteryLevel).updateValue(batteryLevel);
        batteryService.getCharacteristic(Bloomsky.Characteristic.ChargingState).updateValue(2);
        batteryService.getCharacteristic(Bloomsky.Characteristic.StatusLowBattery).updateValue(batteryLevel < 20);
    }

    const file = fs.createWriteStream(filename);
    file.on("finish", function() {
      file.close();
      if (platform.debug) { platform.log("temporary file updated..."); }
    });
    const request = http.get(station.Data.ImageURL, function(response) {
      response.pipe(file);
      if (platform.debug) { platform.log("temporary file updating..."); }
    });
  }

  // remove accessory dynamically from outside event
  public removeAccessory() {
    const platform = this;
    if (platform.debug) { platform.log("Remove Accessory"); }
    platform.api.unregisterPlatformAccessories("homebridge-bloomsky", "Bloomsky", platform.accessories);

    platform.accessories = [] as IAccessory[];
  }

  private updateData() {
    if (this.apiKey !== undefined) {
      const platform = this;
      const client = new Client();
      const args = {
          headers: { Authorization: this.apiKey },
          parameters: { unit: "intl" },
      };

      if (platform.debug) { this.log("updateData"); }

      client.get(this.apiUrl, args, function(data: IStation[], response: any) {

        const error: any = data as any;
        if (error.detail) {
          platform.log(error.detail);
        } else {
          platform.latestData = data;
          platform.latestResponse = response;

          if (data != null && data.length > 0) {

            if (platform.accessories.length > 0) {
              platform.updateExistingAccessories();
            }
            platform.registerNewAccessories();
            platform.updateAccessoriesReachability();
          }
        }

        platform.timeout = setTimeout(function() { platform.updateData(); }.bind(platform),
          platform.debug ? 10000 : 150000); // 2.5 minutes, 10 seconds for debugging
        platform.timeout.unref();
      });
    }
  }

  private stationNeedsToBeRegistered(station: IStation) {
    const stationUuid = Bloomsky.UUIDGen.generate(station.DeviceID).valueOf();
    return this.accessories.filter((accessory) => accessory.UUID.valueOf() === stationUuid).length === 0;
  }

  private updateExistingAccessories() {
    if (this.debug) { this.log("updateExistingAccessories"); }
    const platform = this;

    if (this.debug) {
      this.log(platform.latestData.toString());
    }

    const registeredAccessories = platform.latestData.filter((station) => !this.stationNeedsToBeRegistered(station));

    for (let i = 0, len = registeredAccessories.length; i < len; i++) {
        const station = registeredAccessories[i];
        platform.updateAccessory(station);
    }
  }

  private registerNewAccessories() {
    if (this.debug) { this.log("registerNewAccessories"); }
    const platform = this;

    if (this.debug) {
      this.log(platform.latestData.toString());
    }

    const unregisteredAccessories = platform.latestData.filter((station) => this.stationNeedsToBeRegistered(station));

    for (let i = 0, len = unregisteredAccessories.length; i < len; i++) {
        platform.addAccessory(unregisteredAccessories[i]);
    }
  }

  private updateAccessoriesReachability() {
    if (this.debug) { this.log("Update Reachability"); }
    for (const accessory of this.accessories) {
      accessory.updateReachability(this.latestData != null);
      accessory.reachable = this.latestData != null;
    }
  }
}
