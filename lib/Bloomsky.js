"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var http = require("http");
var node_rest_client_1 = require("node-rest-client");
var url = require("url");
var Ffmpeg_1 = require("./Ffmpeg");
var Bloomsky = /** @class */ (function () {
    // Platform constructor
    // config may be null
    // api may be null if launched from old homebridge version
    function Bloomsky(log, config, api) {
        if (Bloomsky.Accessory === undefined) {
            throw Error("Accessory undefined");
        }
        if (Bloomsky.Service === undefined) {
            throw Error("Service undefined");
        }
        if (Bloomsky.Characteristic === undefined) {
            throw Error("Characteristic undefined");
        }
        if (Bloomsky.Hap === undefined) {
            throw Error("Hap undefined");
        }
        if (Bloomsky.UUIDGen === undefined) {
            throw Error("UUIDGen undefined");
        }
        this.log = log;
        this.accessories = [];
        this.apiKey = config.apiKey;
        this.apiUrl = url.parse(config.apiUrl) || url.parse("https://api.bloomsky.com/api/skydata/");
        this.useIntl = config.useIntl || false;
        this.vcodec = config.vcodec || "libx264";
        this.latestData = [];
        this.debug = config.debug;
        this.log("Bloomsky Init");
        var platform = this;
        if (api) {
            // Save the API object as plugin needs to register new accessory via this object
            platform.api = api;
            // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
            // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
            // Or start discover new accessories.
            platform.api.on("didFinishLaunching", function () {
                platform.log("didFinishLaunching");
                platform.removeAccessory();
                platform.updateData();
            }.bind(this));
        }
        else {
            throw Error("Value for API expected...");
        }
    }
    // Function invoked when homebridge tries to restore cached accessory.
    // Developer can configure accessory here (like setup event handler).
    // Update current value.
    Bloomsky.prototype.configureAccessory = function (accessory) {
        this.log(accessory.displayName + " Configure Accessory");
        var platform = this;
        // Set the accessory to reachable if plugin can currently process the accessory,
        // otherwise set to false and update the reachability later by invoking
        // accessory.updateReachability()
        if (this.latestData != null && this.latestData.length > 0) {
            var stations = platform.latestData
                .filter(function (station) { return accessory.UUID === Bloomsky.UUIDGen.generate(station.DeviceID); });
            accessory.reachable = stations.length === 1 && stations[0] !== undefined;
            if (accessory.reachable) {
                this.updateAccessory(stations[0]);
            }
        }
        else {
            accessory.reachable = false;
        }
        this.accessories.push(accessory);
    };
    // add accessory dynamically from outside event
    Bloomsky.prototype.addAccessory = function (station) {
        this.log("Add Accessory");
        var platform = this;
        var uuid = Bloomsky.UUIDGen.generate(station.DeviceID);
        var filename = station.DeviceID + ".jpg";
        var newAccessory = new Bloomsky.Accessory(station.DeviceName, uuid, Bloomsky.Hap.Accessory.Categories.CAMERA);
        newAccessory.configureCameraSource(new Ffmpeg_1.FFMPEG(Bloomsky.UUIDGen, Bloomsky.Service, Bloomsky.Hap.StreamController, {
            name: station.DeviceName,
            videoConfig: {
                debug: this.debug,
                maxHeight: 640,
                maxStreams: 2,
                maxWidth: 640,
                source: "-loop 1 -i " + filename,
                stillImageSource: "-loop 1 -i " + filename,
                vcodec: platform.vcodec,
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
            var batteryLevel = Math.max(0, Math.min(100, (100 / 2600) * station.Data.Voltage));
            var batteryService = newAccessory.addService(Bloomsky.Service.BatteryService, "Battery");
            batteryService.getCharacteristic(Bloomsky.Characteristic.BatteryLevel).updateValue(batteryLevel);
            batteryService.getCharacteristic(Bloomsky.Characteristic.ChargingState).updateValue(2);
            batteryService.getCharacteristic(Bloomsky.Characteristic.StatusLowBattery).updateValue(batteryLevel < 20);
        }
        var informationService = newAccessory.getService(Bloomsky.Service.AccessoryInformation);
        if (!informationService) {
            informationService = newAccessory.addService(Bloomsky.Service.AccessoryInformation, station.DeviceName);
        }
        informationService.getCharacteristic(Bloomsky.Characteristic.Manufacturer).updateValue("Bloomsky");
        informationService.getCharacteristic(Bloomsky.Characteristic.Model).updateValue(station.Data.DeviceType);
        informationService.getCharacteristic(Bloomsky.Characteristic.SerialNumber).updateValue(station.DeviceID);
        informationService.getCharacteristic(Bloomsky.Characteristic.Identify).updateValue(false);
        informationService.getCharacteristic(Bloomsky.Characteristic.Name).updateValue(station.DeviceName);
        informationService.getCharacteristic(Bloomsky.Characteristic.FirmwareRevision).updateValue(station.Data.DeviceType);
        this.accessories.push(newAccessory);
        this.api.registerPlatformAccessories("homebridge-bloomsky", "Bloomsky", this.accessories);
        var file = fs.createWriteStream(filename);
        file.on("finish", function () {
            file.close();
        });
        var request = http.get(station.Data.ImageURL, function (response) {
            response.pipe(file);
            if (platform.debug) {
                platform.log("temporary file written");
            }
        });
    };
    // add accessory dynamically from outside event
    Bloomsky.prototype.updateAccessory = function (station) {
        if (this.debug) {
            this.log("Update Accessory");
        }
        var platform = this;
        var filename = station.DeviceID + ".jpg";
        var stationUuid = Bloomsky.UUIDGen.generate(station.DeviceID);
        var accessory = platform.accessories
            .filter(function (anyAccessory) { return anyAccessory.UUID === stationUuid; })[0];
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
        var informationService = accessory.getService(Bloomsky.Service.AccessoryInformation);
        informationService.getCharacteristic(Bloomsky.Characteristic.Manufacturer).updateValue("Bloomsky");
        informationService.getCharacteristic(Bloomsky.Characteristic.Model).updateValue(station.Data.DeviceType);
        informationService.getCharacteristic(Bloomsky.Characteristic.SerialNumber).updateValue(station.DeviceID);
        informationService.getCharacteristic(Bloomsky.Characteristic.Identify).updateValue(false);
        informationService.getCharacteristic(Bloomsky.Characteristic.Name).updateValue(station.DeviceName);
        informationService.getCharacteristic(Bloomsky.Characteristic.FirmwareRevision).updateValue(station.Data.DeviceType);
        // I only have a Sky 1 model so I can only make a guess about the battery level
        // for this specific model.
        if (station.Data.DeviceType === "SKY1") {
            // clamp battery level between 0 and 100
            var batteryLevel = Math.max(0, Math.min(100, (100 / 2600) * station.Data.Voltage));
            var batteryService = accessory.getService(Bloomsky.Service.BatteryService);
            batteryService.getCharacteristic(Bloomsky.Characteristic.BatteryLevel).updateValue(batteryLevel);
            batteryService.getCharacteristic(Bloomsky.Characteristic.ChargingState).updateValue(2);
            batteryService.getCharacteristic(Bloomsky.Characteristic.StatusLowBattery).updateValue(batteryLevel < 20);
        }
        var file = fs.createWriteStream(filename);
        file.on("finish", function () {
            file.close();
            if (platform.debug) {
                platform.log("temporary file updated...");
            }
        });
        var request = http.get(station.Data.ImageURL, function (response) {
            response.pipe(file);
            if (platform.debug) {
                platform.log("temporary file updating...");
            }
        });
    };
    // remove accessory dynamically from outside event
    Bloomsky.prototype.removeAccessory = function () {
        var platform = this;
        if (platform.debug) {
            platform.log("Remove Accessory");
        }
        platform.api.unregisterPlatformAccessories("homebridge-bloomsky", "Bloomsky", platform.accessories);
        platform.accessories = [];
    };
    Bloomsky.prototype.updateData = function () {
        if (this.apiKey !== undefined) {
            var platform_1 = this;
            var client = new node_rest_client_1.Client();
            var args = {
                headers: { Authorization: this.apiKey },
                parameters: { unit: "intl" },
            };
            if (platform_1.debug) {
                this.log("updateData");
            }
            client.get(this.apiUrl, args, function (data, response) {
                var error = data;
                if (error.detail) {
                    platform_1.log(error.detail);
                }
                else {
                    platform_1.latestData = data;
                    platform_1.latestResponse = response;
                    if (data != null && data.length > 0) {
                        if (platform_1.accessories.length > 0) {
                            platform_1.updateExistingAccessories();
                        }
                        platform_1.registerNewAccessories();
                        platform_1.updateAccessoriesReachability();
                    }
                }
                platform_1.timeout = setTimeout(function () { platform_1.updateData(); }.bind(platform_1), platform_1.debug ? 10000 : 150000); // 2.5 minutes, 10 seconds for debugging
                platform_1.timeout.unref();
            });
        }
    };
    Bloomsky.prototype.stationNeedsToBeRegistered = function (station) {
        var stationUuid = Bloomsky.UUIDGen.generate(station.DeviceID).valueOf();
        return this.accessories.filter(function (accessory) { return accessory.UUID.valueOf() === stationUuid; }).length === 0;
    };
    Bloomsky.prototype.updateExistingAccessories = function () {
        var _this = this;
        if (this.debug) {
            this.log("updateExistingAccessories");
        }
        var platform = this;
        if (this.debug) {
            this.log(platform.latestData.toString());
        }
        var registeredAccessories = platform.latestData.filter(function (station) { return !_this.stationNeedsToBeRegistered(station); });
        for (var i = 0, len = registeredAccessories.length; i < len; i++) {
            var station = registeredAccessories[i];
            platform.updateAccessory(station);
        }
    };
    Bloomsky.prototype.registerNewAccessories = function () {
        var _this = this;
        if (this.debug) {
            this.log("registerNewAccessories");
        }
        var platform = this;
        if (this.debug) {
            this.log(platform.latestData.toString());
        }
        var unregisteredAccessories = platform.latestData.filter(function (station) { return _this.stationNeedsToBeRegistered(station); });
        for (var i = 0, len = unregisteredAccessories.length; i < len; i++) {
            platform.addAccessory(unregisteredAccessories[i]);
        }
    };
    Bloomsky.prototype.updateAccessoriesReachability = function () {
        if (this.debug) {
            this.log("Update Reachability");
        }
        for (var _i = 0, _a = this.accessories; _i < _a.length; _i++) {
            var accessory = _a[_i];
            accessory.updateReachability(this.latestData != null);
            accessory.reachable = this.latestData != null;
        }
    };
    return Bloomsky;
}());
exports.Bloomsky = Bloomsky;
exports.default = Bloomsky;
