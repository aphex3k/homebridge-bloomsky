var Accessory, Service, Characteristic, UUIDGen, Hap;
var http = require('http');
var fs = require('fs');
var FFMPEG = require('./ffmpeg').FFMPEG;
// var FFMPEG = require('homebridge-camera-ffmpeg/ffmpeg').FFMPEG;
const url = require('url');
const Client = require('node-rest-client').Client;

module.exports = function(homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Hap = homebridge.hap;
  UUIDGen = homebridge.hap.uuid;

  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform("homebridge-bloomsky", "Bloomsky", Bloomsky, true);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function Bloomsky(log, config, api) {
  log("Bloomsky Init");
  var platform = this;
  this.log = log;
  this.config = config || {};
  this.accessories = [];

  this.apiKey = config['apiKey'];
  this.apiUrl = url.parse(config['apiUrl']) || "https://api.bloomsky.com/api/skydata/";
  this.useIntl = config['useIntl'] || false;
  this.vcodec = config['vcodec']  || "libx264";

  if (api) {
      // Save the API object as plugin needs to register new accessory via this object
      this.api = api;

      // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
      // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
      // Or start discover new accessories.
      this.api.on('didFinishLaunching', function() {
        platform.log("DidFinishLaunching");

        platform.removeAccessory();

        if (platform.latestData != null) {
            platform.registerNewAccessories();
        }
      }.bind(this));
  }
  this.updateData(this);

  setInterval(this.updateData, 1000 * 60 * 2.5, this);
}

Bloomsky.prototype.updateData = function(platform) {
    var client = new Client();
    var args = {
        parameters: { unit: "intl" },
        headers: { "Authorization": platform.apiKey }
    };

    platform.log("updateData");

    client.get(platform.apiUrl, args, function (data, response) {
      platform.latestData = data;
      platform.latestResponse = response;

      if (data != null) {
          platform.updateExistingAccessories();
          platform.registerNewAccessories();
          platform.updateAccessoriesReachability();
      }
    });
}

Bloomsky.prototype.stationNeedsToBeRegistered = function (station, platform) {
    return platform.accessories.filter(accessory => accessory.UUID == UUIDGen.generate(station.DeviceID)).length == 0;
}

Bloomsky.prototype.updateExistingAccessories = function () {
    this.log("registerNewAccessories");
    var platform = this;

    var registeredAccessories = platform.latestData.filter(station => !this.stationNeedsToBeRegistered(station, this));

    for (var i = 0, len = registeredAccessories.length; i < len; i++) {
        var station = registeredAccessories[i];

        platform.updateAccessory(station);
    }
}

Bloomsky.prototype.registerNewAccessories = function () {
    this.log("registerNewAccessories");
    var platform = this;

    var unregisteredAccessories = platform.latestData.filter(station => this.stationNeedsToBeRegistered(station, this));

    for (var i = 0, len = unregisteredAccessories.length; i < len; i++) {
        var station = unregisteredAccessories[i];

        platform.addAccessory(station);
    }
}

// Function invoked when homebridge tries to restore cached accessory.
// Developer can configure accessory at here (like setup event handler).
// Update current value.
Bloomsky.prototype.configureAccessory = function(accessory) {
  this.log(accessory.displayName, "Configure Accessory");
  var platform = this;

  // Set the accessory to reachable if plugin can currently process the accessory,
  // otherwise set to false and update the reachability later by invoking
  // accessory.updateReachability()
  accessory.reachable = this.latestData == null;

  if (this.latestData != null) {

    let stations = platform.latestData.filter(station => accessory.UUID == UUIDGen.generate(station.DeviceID))
    if (stations.length == 1 && stations[0]) {
        this.updateAccessory(stations[0]);
    }
  }

  this.accessories.push(accessory);
}

// add accessory dynamically from outside event
Bloomsky.prototype.addAccessory = function(station) {
  this.log("Add Accessory");
  var platform = this;
  var uuid = UUIDGen.generate(station.DeviceID);
  var filename = station.DeviceID + ".jpg";

  let newAccessory = new Accessory(station.DeviceName, uuid, Hap.Accessory.Categories.CAMERA);
  newAccessory.configureCameraSource(new FFMPEG(Hap, {
      "name": station.DeviceName,
      "videoConfig": {
      	"source": "-loop 1 -i "+ filename,
      	"stillImageSource": "-loop 1 -i " + filename,
      	"maxStreams": 2,
      	"maxWidth": 640,
      	"maxHeight": 640,
        "debug" : false,
        "audio" : false,
        "vcodec" : platform.vcodec
      }
  }, this.log, "ffmpeg"));

  newAccessory.addService(Service.TemperatureSensor, "Temperature")
  .getCharacteristic(Characteristic.CurrentTemperature).updateValue(station.Data.Temperature);

  newAccessory.addService(Service.LightSensor, "Luminance")
  .getCharacteristic(Characteristic.CurrentAmbientLightLevel).updateValue(station.Data.Luminance);

  newAccessory.addService(Service.HumiditySensor, "Humidity")
  .getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(station.Data.Humidity);

  newAccessory.addService(Service.MotionSensor, "Rain")
  .getCharacteristic(Characteristic.MotionDetected).updateValue(station.Data.Rain);

  newAccessory.addService(Service.OccupancySensor, "Night")
  .getCharacteristic(Characteristic.OccupancyDetected).updateValue(station.Data.Night);

  // I only have a Sky 1 model so I can only make a guess about the battery level
  // for this specific model.
  if (station.Data.DeviceType == "SKY1")
  {
      // clamp battery level between 0 and 100
      var batteryLevel = Math.max(0, Math.min(100, (100 / 2600) * station.Data.Voltage));

      var batteryService = newAccessory.addService(Service.BatteryService, "Battery");
      batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(batteryLevel);
      batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(2);
      batteryService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(batteryLevel < 20);
  }

  var informationService = newAccessory.getService(Service.AccessoryInformation);

  if (!informationService) {
      informationService = newAccessory.addService(Service.AccessoryInformation, station.DeviceName);
  }
  informationService.getCharacteristic(Characteristic.Manufacturer).updateValue("Bloomsky");
  informationService.getCharacteristic(Characteristic.Model).updateValue( station.Data.DeviceType);
  informationService.getCharacteristic(Characteristic.SerialNumber).updateValue(station.DeviceID);
  informationService.getCharacteristic(Characteristic.Identify).updateValue(false);
  informationService.getCharacteristic(Characteristic.Name).updateValue(station.DeviceName);
  informationService.getCharacteristic(Characteristic.FirmwareRevision).updateValue(station.Data.DeviceType);

  this.accessories.push(newAccessory);
  this.api.registerPlatformAccessories("homebridge-bloomsky", "Bloomsky", this.accessories);

  var file = fs.createWriteStream(filename);
  file.on('finish', function() {
    file.close();
  });
  var request = http.get(station.Data.ImageURL, function(response) {
    response.pipe(file);
    platform.log("temporary file written");
  });
}

// add accessory dynamically from outside event
Bloomsky.prototype.updateAccessory = function(station) {
  this.log("Update Accessory");
  var platform = this;
  var filename = station.DeviceID + ".jpg";
  let accessory = platform.accessories.filter(accessory => accessory.UUID == UUIDGen.generate(station.DeviceID))[0]

  accessory.getService(Service.TemperatureSensor, "Temperature")
  .getCharacteristic(Characteristic.CurrentTemperature).updateValue(station.Data.Temperature);

  accessory.getService(Service.LightSensor, "Luminance")
  .getCharacteristic(Characteristic.CurrentAmbientLightLevel).updateValue(station.Data.Luminance);

  accessory.getService(Service.HumiditySensor, "Humidity")
  .getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(station.Data.Humidity);

  accessory.getService(Service.MotionSensor, "Rain")
  .getCharacteristic(Characteristic.MotionDetected).updateValue(station.Data.Rain);

  accessory.getService(Service.OccupancySensor, "Night")
  .getCharacteristic(Characteristic.OccupancyDetected).updateValue(station.Data.Night);

  var informationService = accessory.getService(Service.AccessoryInformation);
  informationService.getCharacteristic(Characteristic.Manufacturer).updateValue("Bloomsky");
  informationService.getCharacteristic(Characteristic.Model).updateValue( station.Data.DeviceType);
  informationService.getCharacteristic(Characteristic.SerialNumber).updateValue(station.DeviceID);
  informationService.getCharacteristic(Characteristic.Identify).updateValue(false);
  informationService.getCharacteristic(Characteristic.Name).updateValue(station.DeviceName);
  informationService.getCharacteristic(Characteristic.FirmwareRevision).updateValue(station.Data.DeviceType);

  // I only have a Sky 1 model so I can only make a guess about the battery level
  // for this specific model.
  if (station.Data.DeviceType == "SKY1")
  {
      // clamp battery level between 0 and 100
      var batteryLevel = Math.max(0, Math.min(100, (100 / 2600) * station.Data.Voltage))

      var batteryService = accessory.getService(Service.BatteryService);
      batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(batteryLevel);
      batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(2);
      batteryService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(batteryLevel < 20);
  }

  var file = fs.createWriteStream(filename);
  file.on('finish', function() {
    file.close();
    platform.log("temporary file updated...");
  });
  var request = http.get(station.Data.ImageURL, function(response) {
    response.pipe(file);
    platform.log("temporary file updating...");
  });
}

Bloomsky.prototype.updateAccessoriesReachability = function() {
  this.log("Update Reachability");
  for (var index in this.accessories) {
    var accessory = this.accessories[index];
    accessory.updateReachability(this.latestData != null);
    accessory.reachable = this.latestData != null;
  }
}

// remove accessory dynamically from outside event
Bloomsky.prototype.removeAccessory = function() {
  var platform = this;
  platform.log("Remove Accessory");
  platform.api.unregisterPlatformAccessories("homebridge-bloomsky", "Bloomsky", platform.accessories);

  platform.accessories = [];
}
