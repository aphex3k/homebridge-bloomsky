import { expect } from "chai";
import "mocha";
import * as mlog from "mocha-logger";
import { Bloomsky } from "../Bloomsky";
import { IAccessory, ICharacteristic, IHap, IUUIDGen } from "../HAP";
import { IService } from "../HAP";
import { IStation, IStationData } from "../Station";

class TestStation implements IStation {

    public DeviceID: string;
    public DeviceName: string;
    public Data: any;

    constructor() {
        this.DeviceID = "testDeviceId";
        this.DeviceName = "Test Device";
        this.Data = null;
    }
}

const mockHomebridge = {
    api: {
        on(eventName: string, callback: () => void) { callback(); },
        registerPlatformAccessories() { mlog.log("registerPlatformAccessories"); },
        unregisterPlatformAccessories() { mlog.log("unregisterPlatformAccessories"); },
    },
    config: {
        apiUrl : "https://api.bloomsky.com/api/skydata/",
        useIntl : true,
    },
    hap: {
        Characteristic : {} as ICharacteristic,
        Service : {} as IService,
        uuid(textInput: string) { return textInput; },
    },
    log(logText: string) { mlog.log(logText); },

    platformAccessory: {},
    registerPlatform(a: any, b: any, c: any, d: boolean) { return d === true; },
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

    it("should have a mock instance", function() {
      expect(mock).to.not.be.equal(null);
      expect(mock).to.not.be.equal(undefined);
    });

    Bloomsky.Accessory = {} as IAccessory;
    Bloomsky.Service = {} as IService;
    Bloomsky.Characteristic = {} as ICharacteristic;
    Bloomsky.Hap = {} as IHap;
    Bloomsky.UUIDGen = {} as IUUIDGen;

    const bloomsky = new Bloomsky(mock.log, mock.config, mock.api);

    it("constructor should create a new instance", function() {
      expect(bloomsky).to.not.be.equal(null);
      expect(bloomsky).to.not.be.equal(undefined);
    });

    bloomsky.cleanup();
  });
