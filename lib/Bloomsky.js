"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var hap = require("hap-nodejs");
var http = require("http");
var Client = require("typed-rest-client");
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
        this.apiUrl = config.apiUrl || "https://api.bloomsky.com/api/skydata/";
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
                platform.updateData().catch(function (clientError) { platform.log(clientError); });
            }.bind(this));
            platform.api.on("publishCameraAccessories", function () {
                platform.log("publishCameraAccessories");
            });
        }
        else {
            platform.updateData().catch(function (clientError) { platform.log(clientError); });
        }
    }
    // Function invoked when homebridge tries to restore cached accessory.
    // Developer can configure accessory here (like setup event handler).
    // Update current value.
    Bloomsky.prototype.configureAccessory = function (accessory) {
        if (this.debug) {
            this.log("configuring accessory... " + accessory.displayName);
        }
        var platform = this;
        var ffmpeg = this.getFfmpegForStationWithUuid(accessory.UUID);
        accessory.cameraSource = ffmpeg;
        for (var index in ffmpeg.services) {
            if (ffmpeg.hasOwnProperty(index)) {
                var service = ffmpeg.services[index];
                try {
                    accessory.removeService(service);
                }
                catch (_a) {
                    if (this.debug) {
                        this.log("unable to remove existing camera service");
                    }
                }
                finally {
                    accessory.addService(service);
                    if (this.debug) {
                        this.log("added camera service: " + service.displayName);
                    }
                }
            }
        }
        // Do not add any existing services... but this is a good place to add services to earlier registered accessories
        this.accessories.push(accessory);
        // Set the accessory to reachable if plugin can currently process the accessory,
        // otherwise set to false and update the reachability later by invoking
        // accessory.updateReachability()
        if (this.latestData != null && this.latestData.length > 0) {
            if (this.debug) {
                this.log("Configure Accessory " + accessory.displayName);
            }
            var stations = platform.latestData
                .filter(function (station) { return accessory.UUID === Bloomsky.UUIDGen.generate(station.DeviceID); });
            accessory.reachable = stations.length === 1 && stations[0] !== undefined;
            if (accessory.reachable) {
                this.updateAccessory(stations[0]);
            }
        }
        else {
            if (this.debug) {
                this.log("Can't Configure Accessory " + accessory.displayName);
            }
            accessory.reachable = false;
        }
    };
    // add accessory dynamically from outside event
    Bloomsky.prototype.addAccessory = function (station) {
        if (this.debug) {
            this.log("Add Accessory: " + station.DeviceID);
        }
        var uuid = Bloomsky.UUIDGen.generate(station.DeviceID);
        var newAccessory = new Bloomsky.Accessory(station.DeviceName, uuid, hap.Accessory.Categories.CAMERA);
        var cameraSource = this.getFfmpegForStationWithUuid(uuid);
        var countBefore = newAccessory.services.length;
        newAccessory.configureCameraSource(cameraSource);
        if (cameraSource.services.length === 0) {
            throw Error("Camera Control came without services...");
        }
        else {
            for (var _i = 0, _a = newAccessory.services; _i < _a.length; _i++) {
                var service = _a[_i];
                if (this.debug) {
                    this.log(service.UUID + (service.subtype !== undefined ? "." + service.subtype : ""));
                }
            }
        }
        if (newAccessory.services.length <= countBefore
            || newAccessory.cameraSource !== cameraSource
            || newAccessory.services.length < cameraSource.services.length) {
            throw Error("Camera Control Service Registration failed... +" + (cameraSource.services.length - countBefore));
        }
        else {
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
        if (this.debug) {
            this.accessories.push(newAccessory);
        }
        this.log("new accessory pushed...");
        if (this.api !== undefined) {
            // https://github.com/nfarina/homebridge/wiki/Supporting-IP-Camera
            this.api.publishCameraAccessories("homebridge-bloomsky", this.accessories);
        }
        else {
            throw TypeError("this.api UNDEFINED!!!");
        }
        if (this.debug) {
            this.log("new accessory registered...");
        }
        if (this.debug) {
            var output = "";
            for (var property in newAccessory) {
                if (newAccessory.hasOwnProperty(property)) {
                    output += property + ": " + newAccessory[property] + "; ";
                }
            }
            this.log(output);
        }
    };
    // add accessory dynamically from outside event
    Bloomsky.prototype.updateAccessory = function (station) {
        if (this.debug) {
            this.log("Update Accessory");
        }
        var platform = this;
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
        var file = fs.createWriteStream(this.temporaryFilenameForStationUuid(accessory.UUID));
        file.on("finish", function () {
            file.close();
            if (platform.debug) {
                platform.log("temporary file updated...");
            }
        });
        http.get(station.Data.ImageURL, function (response) {
            response.pipe(file);
            platform.log("temporary file written");
        });
    };
    // remove accessory dynamically from outside event
    Bloomsky.prototype.removeAccessory = function () {
        if (this.debug) {
            this.log("Remove Accessory");
        }
        if (this.api !== undefined) {
            this.api.unregisterPlatformAccessories("homebridge-bloomsky", "Bloomsky", this.accessories);
        }
        this.accessories = [];
    };
    Bloomsky.prototype.temporaryFilenameForStationUuid = function (uuid) {
        return uuid + ".jpg";
    };
    Bloomsky.prototype.getFfmpegForStationWithUuid = function (uuid) {
        var filename = this.temporaryFilenameForStationUuid(uuid);
        var ffmpeg = new Ffmpeg_1.FFMPEG(Bloomsky.UUIDGen, Bloomsky.Hap, {
            name: uuid,
            videoConfig: {
                debug: this.debug,
                maxHeight: 640,
                maxStreams: 2,
                maxWidth: 640,
                source: "-loop 1 -i " + filename,
                stillImageSource: "-loop 1 -i " + filename,
                vcodec: this.vcodec,
            },
        }, this.log, "ffmpeg", filename);
        return ffmpeg;
    };
    Bloomsky.prototype.updateData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var platform_1, requestOptions, client, response, error;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.apiKey === undefined)) return [3 /*break*/, 1];
                        if (this.debug) {
                            this.log("Skipping updating data...");
                        }
                        return [3 /*break*/, 3];
                    case 1:
                        platform_1 = this;
                        requestOptions = {
                            additionalHeaders: { Authorization: this.apiKey },
                        };
                        client = new Client.RestClient("NodeJS");
                        if (platform_1.debug) {
                            this.log("updateData");
                        }
                        return [4 /*yield*/, client.get(this.apiUrl + "?unit=intl", requestOptions).catch(function (clientError) {
                                if (platform_1.debug) {
                                    platform_1.log(clientError);
                                }
                            })];
                    case 2:
                        response = _a.sent();
                        error = response;
                        if (error !== undefined && error.detail) {
                            platform_1.log(error.detail);
                        }
                        else if (response != null) {
                            if (response.result != null) {
                                platform_1.latestData = response.result;
                            }
                            if (response != null && platform_1.latestData.length > 0) {
                                if (platform_1.accessories.length > 0) {
                                    platform_1.updateExistingAccessories();
                                }
                                platform_1.registerNewAccessories();
                                platform_1.updateAccessoriesReachability();
                            }
                        }
                        platform_1.timeout = setTimeout(function () {
                            platform_1.updateData().catch(function (clientError) { platform_1.log(clientError); });
                        }.bind(platform_1), platform_1.debug ? 30000 : 150000); // 2.5 minutes, 10 seconds for debugging
                        platform_1.timeout.unref();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    Bloomsky.prototype.stationNeedsToBeRegistered = function (station) {
        if (this.debug) {
            this.log("stationNeedsToBeRegistered: " + station);
        }
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
        if (platform.latestData.length === 0) {
            return;
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
            // accessory.updateReachability(this.latestData != null); // Reachability update is no longer being supported
            accessory.reachable = this.latestData != null;
        }
    };
    return Bloomsky;
}());
exports.Bloomsky = Bloomsky;
exports.default = Bloomsky;
