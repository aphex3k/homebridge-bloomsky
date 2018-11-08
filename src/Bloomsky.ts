import * as fs from "fs";
import * as hap from "hap-nodejs";
import * as http from "http";
import * as Client from "typed-rest-client";
import { IHeaders } from "typed-rest-client/Interfaces";
import { FFMPEG } from "./Ffmpeg";
import { API } from "./homebridge";
import { PlatformAccessory } from "./PlatformAccessory";
import { IStation } from "./Station";

export { Bloomsky };

export default class Bloomsky {

  public static Accessory: PlatformAccessory;
  public static Service: HAPNodeJS.Service;
  public static Characteristic: HAPNodeJS.Characteristic;
  public static Hap: HAPNodeJS.HAPNodeJS;
  public static UUIDGen: HAPNodeJS.uuid;

  public timeout: NodeJS.Timeout | undefined;
  public accessories: PlatformAccessory[];

  public log: (text: string) => void;

  private apiKey: string;
  private apiUrl: string;
  private vcodec: string;
  private api: API | undefined;
  private latestData: IStation[];
  private debug: boolean;

  // Platform constructor
  // config may be null
  // api may be null if launched from old homebridge version
  constructor(log: (text: string) => void, config: any, api: API) {

    if (Bloomsky.Accessory === undefined) { throw Error("Accessory undefined"); }
    if (Bloomsky.Service === undefined) { throw Error("Service undefined"); }
    if (Bloomsky.Characteristic === undefined) { throw Error("Characteristic undefined"); }
    if (Bloomsky.Hap === undefined) { throw Error("Hap undefined"); }
    if (Bloomsky.UUIDGen === undefined) { throw Error("UUIDGen undefined"); }

    this.log = log;
    this.accessories = [] as PlatformAccessory[];
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || "https://api.bloomsky.com/api/skydata/";
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

        platform.updateData().catch((clientError) => { platform.log(clientError); });

      }.bind(this));

      platform.api.on("publishCameraAccessories", function() {
        platform.log("publishCameraAccessories");
      });

    } else {
        platform.updateData().catch((clientError) => { platform.log(clientError); });
    }
  }

  // Function invoked when homebridge tries to restore cached accessory.
  // Developer can configure accessory here (like setup event handler).
  // Update current value.
  public configureAccessory(accessory: PlatformAccessory) {

    if (this.debug) { this.log("configuring accessory... " + accessory.displayName); }

    const platform = this;
    const ffmpeg = this.getFfmpegForStationWithUuid(accessory.UUID);
    accessory.cameraSource = ffmpeg;

    for (const index in ffmpeg.services) {
      if (ffmpeg.hasOwnProperty(index)) {
        const service = ffmpeg.services[index];
        try {
          accessory.removeService(service);
        } catch {
          if (this.debug) { this.log("unable to remove existing camera service"); }
        } finally {
          accessory.addService(service);
          if (this.debug) { this.log("added camera service: " + service.displayName); }
        }
      }
    }

    // Do not add any existing services... but this is a good place to add services to earlier registered accessories

    this.accessories.push(accessory);
    // Set the accessory to reachable if plugin can currently process the accessory,
    // otherwise set to false and update the reachability later by invoking
    // accessory.updateReachability()
    if (this.latestData != null && this.latestData.length > 0) {
      if (this.debug) { this.log("Configure Accessory " + accessory.displayName); }
      const stations = platform.latestData
        .filter((station) => accessory.UUID === Bloomsky.UUIDGen.generate(station.DeviceID));

      accessory.reachable = stations.length === 1 && stations[0] !== undefined;

      if (accessory.reachable) {
        this.updateAccessory(stations[0]);
      }
    } else {
      if (this.debug) { this.log("Can't Configure Accessory " + accessory.displayName); }
      accessory.reachable = false;
    }
  }

  // add accessory dynamically from outside event
  public addAccessory(station: IStation) {

    if (this.debug) { this.log("Add Accessory: " + station.DeviceID); }

    const uuid = Bloomsky.UUIDGen.generate(station.DeviceID);
    const newAccessory = new Bloomsky.Accessory(station.DeviceName, uuid, hap.Accessory.Categories.CAMERA);
    const cameraSource = this.getFfmpegForStationWithUuid(uuid);
    const countBefore = newAccessory.services.length;

    newAccessory.configureCameraSource(cameraSource);

    if (cameraSource.services.length === 0) {
      throw Error ("Camera Control came without services...");
    } else {
      for (const service of newAccessory.services) {
        if (this.debug) { this.log(service.UUID + (service.subtype !== undefined ? "." + service.subtype : "")); }
      }
    }

    if (newAccessory.services.length <= countBefore
      || newAccessory.cameraSource !== cameraSource
      || newAccessory.services.length < cameraSource.services.length
      ) {
      throw Error ("Camera Control Service Registration failed... +" + (cameraSource.services.length - countBefore));
    } else {
      if (this.debug) {
        this.log("Registered " +
        (cameraSource.services.length - countBefore) +
        " Camera Control Services");
      }
    }

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

    if (this.debug) { this.accessories.push(newAccessory); }

    this.log("new accessory pushed...");

    if (this.api !== undefined ) {
      // https://github.com/nfarina/homebridge/wiki/Supporting-IP-Camera
      this.api.publishCameraAccessories("homebridge-bloomsky", this.accessories);
    } else {
      throw TypeError("this.api UNDEFINED!!!");
    }

    if (this.debug) { this.log("new accessory registered..."); }

    if (this.debug) {
      let output = "";
      for (const property in newAccessory) {
        if (newAccessory.hasOwnProperty(property)) {
          output += property + ": " + newAccessory[property] + "; ";
        }
      }
      this.log(output);
    }
  }

  // add accessory dynamically from outside event
  public updateAccessory(station: IStation) {
    if (this.debug) { this.log("Update Accessory"); }

    const platform = this;
    const stationUuid = Bloomsky.UUIDGen.generate(station.DeviceID);
    const accessory = platform.accessories
    .filter((anyAccessory) => anyAccessory.UUID === stationUuid)[0] as PlatformAccessory;

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

    const file = fs.createWriteStream(this.temporaryFilenameForStationUuid(accessory.UUID));
    file.on("finish", function() {
      file.close();
      if (platform.debug) { platform.log("temporary file updated..."); }
    });
    http.get(station.Data.ImageURL, function(response) {
      response.pipe(file);
      platform.log("temporary file written");
    });
  }

  // remove accessory dynamically from outside event
  public removeAccessory() {
    if (this.debug) { this.log("Remove Accessory"); }

    if (this.api !== undefined) {
      this.api.unregisterPlatformAccessories("homebridge-bloomsky", "Bloomsky", this.accessories);
    }
    this.accessories = [] as PlatformAccessory[];
  }

  public temporaryFilenameForStationUuid(uuid: string): string {
    return uuid + ".jpg";
  }

  public getFfmpegForStationWithUuid(uuid: string): FFMPEG {
    const filename = this.temporaryFilenameForStationUuid(uuid);

    const ffmpeg = new FFMPEG(Bloomsky.UUIDGen, Bloomsky.Hap, {
      name: uuid,
      videoConfig: {
        debug : this.debug,
        maxHeight: 640,
        maxStreams: 2,
        maxWidth: 640,
        source: "-loop 1 -i " + filename,
        stillImageSource: "-loop 1 -i " + filename,
        vcodec : this.vcodec,
      },
    }, this.log, "ffmpeg", filename);

    return ffmpeg;
  }

  private async updateData() {
    if (this.apiKey === undefined) {
      if (this.debug) { this.log("Skipping updating data..."); }
    } else {
      const platform = this;

      const requestOptions: Client.IRequestOptions = {
        additionalHeaders: { Authorization: this.apiKey } as IHeaders,
      };

      const client = new Client.RestClient("NodeJS");

      if (platform.debug) { this.log("updateData"); }

      const response = await client.get<IStation[]>(this.apiUrl + "?unit=intl", requestOptions).catch((clientError) => {
        if (platform.debug) { platform.log(clientError); }
      });

      const error: any = response as any;
      if (error !== undefined && error.detail) {
        platform.log(error.detail);
      } else if (response != null) {
        if (response.result != null) {
          platform.latestData = response.result;
        }

        if (response != null && platform.latestData.length > 0) {

          if (platform.accessories.length > 0) {
            platform.updateExistingAccessories();
          }
          platform.registerNewAccessories();
          platform.updateAccessoriesReachability();
        }
      }

      platform.timeout = setTimeout(function() {
        platform.updateData().catch((clientError) => { platform.log(clientError); });
      }.bind(platform),
        platform.debug ? 30000 : 150000); // 2.5 minutes, 10 seconds for debugging
      platform.timeout.unref();
    }
  }

  private stationNeedsToBeRegistered(station: IStation) {
    if (this.debug) { this.log ("stationNeedsToBeRegistered: " + station); }
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

    if (platform.latestData.length === 0) {
      return;
    }
    const unregisteredAccessories = platform.latestData.filter((station) => this.stationNeedsToBeRegistered(station));

    for (let i = 0, len = unregisteredAccessories.length; i < len; i++) {
        platform.addAccessory(unregisteredAccessories[i]);
    }
  }

  private updateAccessoriesReachability() {
    if (this.debug) { this.log("Update Reachability"); }
    for (const accessory of this.accessories) {
      // accessory.updateReachability(this.latestData != null); // Reachability update is no longer being supported
      accessory.reachable = this.latestData != null;
    }
  }
}
