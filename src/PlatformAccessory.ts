import { Bloomsky } from "./platform";
import { PlatformAccessory } from "homebridge";
import { Station } from "./Station";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class BloomskyPlatformAccessory {
  constructor(
    private readonly platform: Bloomsky,
    private readonly accessory: PlatformAccessory,
    station: Station
  ) {
    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, "Bloomsky")
      .setCharacteristic(
        this.platform.Characteristic.Model,
        station.Data.DeviceType
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        station.DeviceID
      )
      .setCharacteristic(this.platform.Characteristic.Name, station.DeviceName);

    // I only have a Sky 1 model so I can only make a guess about the battery level
    // for this specific model.
    if (station.Data.DeviceType === "SKY1") {
      // clamp battery level between 0 and 100
      const batteryLevel = Math.max(
        0,
        Math.min(100, (100 / 2600) * station.Data.Voltage)
      );

      const batteryService =
        this.accessory.getService(this.platform.Service.BatteryService) ||
        this.accessory.addService(this.platform.Service.BatteryService);

      batteryService
        .getCharacteristic(this.platform.Characteristic.BatteryLevel)
        .updateValue(batteryLevel);
      batteryService
        .getCharacteristic(this.platform.Characteristic.ChargingState)
        .updateValue(2);
      batteryService
        .getCharacteristic(this.platform.Characteristic.StatusLowBattery)
        .updateValue(batteryLevel < 20);
      batteryService.setCharacteristic(
        this.platform.Characteristic.Name,
        station.DeviceName
      );
    }

    this.accessory
      .addService(this.platform.Service.TemperatureSensor)
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .updateValue(station.Data.Temperature);

    this.accessory
      .addService(this.platform.Service.LightSensor, "Luminance")
      .getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
      .updateValue(station.Data.Luminance);

    this.accessory
      .addService(this.platform.Service.HumiditySensor, "Humidity")
      .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .updateValue(station.Data.Humidity);

    this.accessory
      .addService(this.platform.Service.MotionSensor, "Rain")
      .getCharacteristic(this.platform.Characteristic.MotionDetected)
      .updateValue(station.Data.Rain);

    this.accessory
      .addService(this.platform.Service.OccupancySensor, "Night")
      .getCharacteristic(this.platform.Characteristic.OccupancyDetected)
      .updateValue(station.Data.Night);
  }
}
