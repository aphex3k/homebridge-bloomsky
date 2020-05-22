import * as Client from "typed-rest-client";

import {
  API,
  APIEvent,
  CameraControllerOptions,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from "homebridge";
import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";

import { BloomskyFFMPEGStreamingDelegate } from "./streamingDelegate";
import { BloomskyPlatformAccessory } from "./platformAccessory";
import { EventEmitter } from "events";
import { Station } from "./Station";

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class Bloomsky implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap
    .Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  // plugin configuration data
  private apiKey: string;
  private apiUrl: string;
  private vcodec: string;
  private latestData: Station[];
  private timeout: NodeJS.Timeout | undefined;

  private emitters: EventEmitter[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    this.log.debug("Finished initializing platform:", this.config.name);

    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || "https://api.bloomsky.com/api/skydata/";
    this.vcodec = config.vcodec || "libx264";
    this.latestData = [] as Station[];

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.debug("Executed didFinishLaunching callback");
      // run the method to discover / register your devices as accessories

      this.discoverDevices();
      this.updateData();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info("Loading accessory from cache:", accessory.displayName);

    const streamingDelegate = new BloomskyFFMPEGStreamingDelegate(this.api.hap);
    this.emitters[accessory.UUID] = streamingDelegate.bloomskyEvents;

    const options: CameraControllerOptions = {
      cameraStreamCount: 2, // HomeKit requires at least 2 streams, but 1 is also just fine
      delegate: streamingDelegate,

      streamingOptions: {
        // srtp: true, // legacy option which will just enable AES_CM_128_HMAC_SHA1_80 (can still be used though)
        supportedCryptoSuites: [
          this.api.hap.SRTPCryptoSuites.NONE,
          this.api.hap.SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80,
        ], // NONE is not supported by iOS just there for testing with Wireshark for example
        video: {
          codec: {
            profiles: [
              this.api.hap.H264Profile.BASELINE,
              this.api.hap.H264Profile.MAIN,
              this.api.hap.H264Profile.HIGH,
            ],
            levels: [
              this.api.hap.H264Level.LEVEL3_1,
              this.api.hap.H264Level.LEVEL3_2,
              this.api.hap.H264Level.LEVEL4_0,
            ],
          },
          resolutions: [
            [1920, 1080, 30], // width, height, framerate
            [1280, 960, 30],
            [1280, 720, 30],
            [1024, 768, 30],
            [640, 480, 30],
            [640, 360, 30],
            [480, 360, 30],
            [480, 270, 30],
            [320, 240, 30],
            [320, 240, 15], // Apple Watch requires this configuration (Apple Watch also seems to required OPUS @16K)
            [320, 180, 30],
          ],
        },
        /* audio option is omitted, as it is not supported in this example; HAP-NodeJS will fake an appropriate audio codec
        audio: {
            comfort_noise: false, // optional, default false
            codecs: [
                {
                    type: AudioStreamingCodecType.OPUS,
                    audioChannels: 1, // optional, default 1
                    samplerate: [AudioStreamingSamplerate.KHZ_16, AudioStreamingSamplerate.KHZ_24], 
                    // 16 and 24 must be present for AAC-ELD or OPUS
                },
            ],
        },
        // */
      },
    };

    const cameraController = new this.api.hap.CameraController(options);
    streamingDelegate.controller = cameraController;

    accessory.configureController(cameraController);
    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    if (this.latestData.length === 0) {
      return;
    }

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of this.latestData) {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.DeviceID);

      if (this.emitters[uuid]) {
        const emitter = this.emitters[uuid] as EventEmitter;
        emitter.emit("ImageURL", device.Data.ImageURL);
      }

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid
      );

      if (existingAccessory) {
        // the accessory already exists
        this.log.info(
          "Restoring existing accessory from cache:",
          existingAccessory.displayName
        );

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.context.device = device;

        this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new BloomskyPlatformAccessory(this, existingAccessory, device);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info("Adding new accessory:", device.DeviceName);

        // create a new accessory
        const accessory = new this.api.platformAccessory(
          device.DeviceName,
          uuid
        );

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        new BloomskyPlatformAccessory(this, accessory, device);

        this.configureAccessory(accessory);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    }
  }

  /**
   * Fetch data from the API, then
   * 1. register new devices
   * 2. update values for existing devices
   */
  private async updateData() {
    const requestOptions: Client.IRequestOptions = {
      additionalHeaders: { Authorization: this.apiKey },
    };

    const client = new Client.RestClient("NodeJS");

    const response = await client
      .get<Station[]>(this.apiUrl + "?unit=intl", requestOptions)
      .catch((clientError) => {
        this.log.error(clientError);
      });

    const error: any = response as any;
    if (error !== undefined && error.detail) {
      this.log.error(error.detail);
    } else if (response !== null) {
      const r = response as Client.IRestResponse<Station[]>;
      if (r.result !== null) {
        this.latestData = r.result;
      }

      this.discoverDevices();

      this.timeout = setTimeout(
        (() => {
          this.updateData().catch((clientError) => {
            this.log.error(clientError);
          });
        }).bind(this),
        150000
      );
      this.timeout.unref();
    }
  }
}
