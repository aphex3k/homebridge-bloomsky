import "mocha";

import * as fs from "fs";
import * as hap from "hap-nodejs";
import * as ip from "ip";
import * as mlog from "mocha-logger";
import * as waitUntil from "async-wait-until";

import API from "./src/homebridge";
import { Bloomsky } from "./src/Bloomsky";
import { EventEmitter } from "events";
import FFMPEG from "./src/Ffmpeg";
import { PlatformAccessory } from "./src/PlatformAccessory";
import { StreamRequest } from "./src/StreamRequest";
import { expect } from "chai";

const mockHomebridge = {
  accessory: {} as PlatformAccessory,
  api: new API(),
  config: {
    apiKey: "this-is-not-a-valid-api-key==",
    // tslint:disable-next-line:max-line-length
    apiUrl:
      "https://gist.githubusercontent.com/aphex3k/d7d9b6399fc8701a32ff4fb87bdd91dc/raw/40b030a8b6b70f95bae3b38106609dfda47c0c46/api-result.json",
    debug: true,
    useIntl: true,
  },
  hap,
  log(logText: string) {
    mlog.log(logText);
  },
  registerPlatform(a: any, b: any, c: any, d: boolean) {
    return d === true;
  },
  version: "2.2",
};

describe("Mock Homebridge", () => {
  it("should provide mock functionality", () => {
    expect(mockHomebridge).to.not.be.equal(null);
    expect(mockHomebridge).to.not.be.equal(undefined);

    expect(mockHomebridge.version).to.not.be.equal(null);
    expect(mockHomebridge.version).to.not.be.equal(undefined);

    expect(mockHomebridge.hap).to.not.be.equal(null);
    expect(mockHomebridge.hap).to.not.be.equal(undefined);

    expect(mockHomebridge.registerPlatform).to.not.be.equal(null);
    expect(mockHomebridge.registerPlatform).to.not.be.equal(undefined);

    expect(mockHomebridge.log).to.not.be.equal(null);
    expect(mockHomebridge.log).to.not.be.equal(undefined);

    expect(mockHomebridge.config).to.not.be.equal(null);
    expect(mockHomebridge.config).to.not.be.equal(undefined);

    expect(mockHomebridge.config.apiUrl).to.not.be.equal(null);
    expect(mockHomebridge.config.apiUrl).to.not.be.equal(undefined);

    expect(mockHomebridge.config.useIntl).to.be.equal(true);

    expect(mockHomebridge.hap.uuid).to.not.be.equal(null);
    expect(mockHomebridge.hap.uuid).to.not.be.equal(undefined);
  });
});

describe("Bloomsky", () => {
  const mock = mockHomebridge;

  it("should have a mock instance", function () {
    expect(mock).to.not.be.equal(null);
    expect(mock).to.not.be.equal(undefined);
  });

  Bloomsky.Accessory = mock.accessory;
  Bloomsky.Service = hap.Service;
  Bloomsky.Characteristic = hap.Characteristic;
  Bloomsky.UUIDGen = hap.uuid;
  Bloomsky.Hap = hap;

  const bloomsky = new Bloomsky(mock.log, mock.config, mock.api);

  it("constructor should create a new instance", function () {
    expect(bloomsky).to.not.be.equal(null);
    expect(bloomsky).to.not.be.equal(undefined);
  });

  it("should know about no accessories before loading from api", function () {
    expect(bloomsky.accessories.length).to.be.equal(0);
  });

  it("should calculate a matching UUID for input", function () {
    expect(Bloomsky.UUIDGen).to.not.be.equal(null);
    expect(Bloomsky.UUIDGen).to.not.be.equal(undefined);

    const uuid = Bloomsky.UUIDGen.generate("test"); // a94a8fe5-ccb1-49ba-a1c4-c0873d391e98
    expect(uuid).to.not.be.equal(null);
    expect(uuid).to.be.equal("a94a8fe5-ccb1-49ba-a1c4-c0873d391e98");
  });

  // it("should know about exactly one accessory after loading from api", async function() {
  //     this.timeout(10000);

  //     // since we are not testing in a full blown homebridge environment, trigger
  //     // didFinishLaunching event manually
  //     (mock.api as EventEmitter).emit("didFinishLaunching");

  //     try {
  //         const result = await waitUntil(() => {
  //           return bloomsky.accessories.length > 0;
  //         }, 10000); // ms

  //         expect(bloomsky.accessories.length).to.be.equal(1);
  //     } catch (error) {
  //         expect(bloomsky.accessories.length).to.be.equal(1);
  //     }

  //     const accessory = bloomsky.accessories[0];

  //     expect(accessory.UUID).to.be.equal("8d993ccd-f628-4e26-a170-a949ee2a3870");
  // });

  // it("should only know about exactly one camera accessory", function() {
  //     const accessory = bloomsky.accessories[0];

  //     expect(accessory.category).to.not.be.equal(HAPNodeJS.Accessory.Categories.OTHER);
  //     expect(accessory.category).to.be.equal(HAPNodeJS.Accessory.Categories.CAMERA);
  //     expect(accessory.reachable).to.be.equal(true);
  // });

  // it("should know about an accessory with services attached", function() {
  //     const accessory = bloomsky.accessories[0];

  //     const temp = accessory.getService(Bloomsky.Service.TemperatureSensor);
  //     expect(temp).to.not.be.equal(undefined);
  //     expect(temp.UUID).to.be.equal(Bloomsky.Service.TemperatureSensor.UUID);

  //     const light = accessory.getService(Bloomsky.Service.LightSensor);
  //     expect(light).to.not.be.equal(undefined);
  //     expect(light.UUID).to.be.equal(Bloomsky.Service.LightSensor.UUID);

  //     const humidity = accessory.getService(Bloomsky.Service.HumiditySensor);
  //     expect(humidity).to.not.be.equal(undefined);
  //     expect(humidity.UUID).to.be.equal(Bloomsky.Service.HumiditySensor.UUID);

  //     const motion = accessory.getService(Bloomsky.Service.MotionSensor);
  //     expect(motion).to.not.be.equal(undefined);
  //     expect(motion.UUID).to.be.equal(Bloomsky.Service.MotionSensor.UUID);

  //     const night = accessory.getService(Bloomsky.Service.OccupancySensor);
  //     expect(night).to.not.be.equal(undefined);
  //     expect(night.UUID).to.be.equal(Bloomsky.Service.OccupancySensor.UUID);

  //     const info = accessory.getService(Bloomsky.Service.AccessoryInformation);
  //     expect(info).to.not.be.equal(undefined);
  //     expect(info.UUID).to.be.equal(Bloomsky.Service.AccessoryInformation.UUID);

  //     const battery = accessory.getService(Bloomsky.Service.BatteryService);
  //     expect(battery).to.not.be.equal(undefined);
  //     expect(battery.UUID).to.be.equal(Bloomsky.Service.BatteryService.UUID);
  // });

  // it("should have an accessory with a camera stream controller configured", function() {
  //     const accessory = bloomsky.accessories[0];

  //     expect(accessory.cameraSource).to.not.be.equal(undefined);

  //     const cameraSource = accessory.cameraSource as FFMPEG;

  //     expect(cameraSource.createCameraControlService).to.not.be.equal(undefined);
  //     expect(cameraSource.handleCloseConnection).to.not.be.equal(undefined);
  //     expect(cameraSource.handleSnapshotRequest).to.not.be.equal(undefined);
  //     expect(cameraSource.handleStreamRequest).to.not.be.equal(undefined);
  //     expect(cameraSource.prepareStream).to.not.be.equal(undefined);
  // });

  // it("should have one accessory that can handle snapshot requests", async function() {

  //     this.timeout(10000);

  //     try {
  //         const result = await waitUntil(() => {
  //             const testFilename = "8d993ccd-f628-4e26-a170-a949ee2a3870.jpg";
  //             return fs.existsSync(testFilename) && fs.statSync(testFilename).size > 0;
  //         }, 3000); // ms
  //     } catch (error) {
  //         mock.log("the camera image should have been cached by now...");
  //         expect(error).to.be.equal(undefined);
  //     }

  //     const accessory = bloomsky.accessories[0];
  //     const cameraSource = accessory.cameraSource as FFMPEG;

  //     expect(cameraSource.createCameraControlService).to.not.be.equal(undefined);

  //     const createCameraControlService = function() { cameraSource.createCameraControlService(); };
  //     expect(createCameraControlService).to.not.throw();

  //     const handleSnapshotRequest = function() {
  //         cameraSource.handleSnapshotRequest({
  //             height: 720,
  //             width: 1280,
  //         },
  //         function(error, buffer) {
  //             if (error !== undefined) {
  //                 mock.log(error);
  //             }
  //             expect(error).to.be.equal(undefined);
  //             expect(buffer.length).to.be.greaterThan(0);
  //         });
  //     };
  //     expect(handleSnapshotRequest).to.not.throw();
  // });

  // it("should have one accessory that can handle stream requests", async function() {

  //     this.timeout(10000);

  //     try {
  //         const result = await waitUntil(() => {
  //             const testFilename = "8d993ccd-f628-4e26-a170-a949ee2a3870.jpg";
  //             return fs.existsSync(testFilename) && fs.statSync(testFilename).size > 0;
  //         }, 3000); // ms
  //     } catch (error) {
  //         mock.log("the camera image should have been cached by now...");
  //         expect(error).to.be.equal(undefined);
  //     }

  //     const accessory = bloomsky.accessories[0];
  //     const cameraSource = accessory.cameraSource as FFMPEG;
  //     const testSessionId = Bloomsky.UUIDGen.generate("testSessionId");
  //     const request: StreamRequest = {
  //         audio: undefined,
  //         sessionID: testSessionId,
  //         targetAddress: ip.address(),
  //         type: "start",
  //         video: {
  //             fps: 30,
  //             height: 640,
  //             max_bit_rate: 600,
  //             port: 12345,
  //             srtp_key: Uint8Array.from(new Set([1, 2, 3, 4])),
  //             srtp_salt: Uint8Array.from(new Set([1, 2, 3, 4])),
  //             ssrc: 123,
  //             width: 640,
  //         },
  //     };

  //     const prepareStream = function() {
  //         cameraSource.prepareStream(request, function(response) {
  //             mock.log("Stream Prepared");
  //         });
  //     };
  //     expect(prepareStream).to.not.throw();

  //     const handleStreamRequest = function() {
  //         cameraSource.handleStreamRequest(request);
  //     };
  //     expect(handleStreamRequest).to.not.throw();

  //     mock.log("waiting for stream...");
  //     try {
  //         const result = await waitUntil(() => {
  //             return false;
  //         }, 550); // ms
  //     } catch (error) {
  //         mock.log("closing stream...");
  //     }

  //     const handleCloseConnection = function() {
  //         cameraSource.handleCloseConnection(testSessionId);
  //     };
  //     expect(handleCloseConnection).to.not.throw();
  // });
});
