import { spawn } from "child_process";
import * as crypto from "crypto";
import hapnodejs = require("hap-nodejs");
import * as ip from "ip";
import Jimp = require("jimp");
import optional = require("optional");
import { AddressResponse } from "./AddressResponse";
import { AudioResponse } from "./AudioResponse";
import { SessionInfo } from "./Session";
import { SnapshotRequest } from "./SnapshotRequest";
import { StreamController } from "./StreamController";
import { StreamRequest } from "./StreamRequest";
import { StreamResponse } from "./StreamResponse";
import { VideoResponse } from "./VideoResponse";

export default class FFMPEG implements HAPNodeJS.CameraSource {
  public streamController: any;
  public streamControllers: StreamController[] = [];
  public cameraControllers: any[] = [];
  public pendingSessions: SessionInfo[] = [];
  public ongoingSessions: SessionInfo[] = [];
  public services: HAPNodeJS.Service[] = [];
  public name: string;
  public uuid: HAPNodeJS.uuid;
  public service: any;

  private log: (text: string) => void;
  private vcodec: string;
  private videoProcessor: string;
  private fps: number;
  private maxBitrate: number;
  private debug: boolean;
  private ffmpegSource: string;
  private ffmpegImageSource: string;
  private stillImageFilename: string;
  private sharp: any;

  constructor(
      uuidfunc: HAPNodeJS.uuid,
      hap: any,
      cameraConfig: any,
      log: (text: string) => void,
      videoProcessor: string,
      stillImageFilename: string) {

    if (uuidfunc === undefined) { throw Error("UUIDGen undefined"); }
    if (hap.Service === undefined) { throw Error("Service undefined"); }
    if (log === undefined) { throw Error("Log undefined"); }
    if (hap.StreamController === undefined) { throw Error("StreamController undefined"); }

    if (cameraConfig.videoConfig.debug) { log("FFMPEG constructor"); }

    this.sharp = optional("sharp");

    this.uuid = uuidfunc;
    this.service = hap.Service;
    this.log = log;
    this.streamController = hap.StreamController;

    const ffmpegOpt = cameraConfig.videoConfig;
    this.name = cameraConfig.name;
    this.vcodec = ffmpegOpt.vcodec;
    this.videoProcessor = videoProcessor || "ffmpeg";
    this.fps = ffmpegOpt.maxFPS || 10;
    this.maxBitrate = ffmpegOpt.maxBitrate || 300;
    this.debug = ffmpegOpt.debug || false;

    if (this.debug) { log("Debug loggin enabled..."); }

    if (!ffmpegOpt.source) {
        throw new Error("Missing source for camera.");
    }

    this.ffmpegSource = ffmpegOpt.source;
    this.ffmpegImageSource = ffmpegOpt.stillImageSource;
    this.stillImageFilename = stillImageFilename;

    const numberOfStreams: number = ffmpegOpt.maxStreams || 2;

    const options = {
        audio: {
            codecs: [
                {
                    samplerate: 24, // 8, 16, 24 KHz
                    type: "OPUS", // Audio Codec
                },
                {
                    samplerate: 16,
                    type: "AAC-eld",
                },
            ],
            comfort_noise: false,
        },
        disable_audio_proxy: false, // If proxy = true, you can opt out audio proxy via this
        proxy: false, // Requires RTP/RTCP MUX Proxy
        srtp: true, // Supports SRTP AES_CM_128_HMAC_SHA1_80 encryption
        video: {
            codec: {
                levels: [0, 1, 2], // Enum, please refer StreamController.VideoCodecParamLevelTypes
                profiles: [0, 1, 2], // Enum, please refer StreamController.VideoCodecParamProfileIDTypes
            },
            resolutions: [
                [640, 640, 30],
                [640, 640, 15],
                [640, 480, 30],
                [640, 480, 15],
                [640, 360, 30],
                [640, 360, 15],
                [480, 360, 30],
                [480, 360, 15],
                [480, 270, 30],
                [480, 270, 15],
                [320, 240, 30],
                [320, 240, 15], // Apple Watch requires this configuration
                [320, 180, 30],
                [320, 180, 15],
              ],
        },
    };

    this.createCameraControlService();

    if (this.cameraControllers.length < 1) {
        throw Error("Did not push camera controller...");
    }

    this._createStreamControllers(numberOfStreams, options);
  }

  public handleCloseConnection(connectionID: any) {
    if (this.debug) { this.log("closing connection for " + this.streamControllers.length + " stream(s)..."); }
    this.streamControllers.forEach(function(controller: StreamController) {
        controller.handleCloseConnection(connectionID);
    });
  }

  // Image request: {width: number, height: number}
  // Please override this and invoke callback(error, image buffer) when the snapshot is ready
  public handleSnapshotRequest(request: SnapshotRequest, callback: (error: any, Buffer) => any) {

    let dir = __dirname;
    if (dir.endsWith("/lib")) {
        dir = dir.replace("/lib", "");
    }
    const path = dir + "/" + this.stillImageFilename;

    if (this.debug) { this.log("Delivering snapshot at path: " + path); }

    if (this.sharp == null) {
        if (this.debug) { this.log("... using Jimp"); }
        Jimp.read(path)
        .then((image) => {
            image
            .resize(request.width, Jimp.AUTO)
            .crop(0, (image.bitmap.height - request.height) / 2, request.width, request.height)
            .quality(90)
            .getBuffer(Jimp.MIME_JPEG, (error, buffer) => {
                if (error !== null) {
                    if (this.debug) { this.log("Error getting buffer for snapshot: " + error); }
                    callback(error, undefined);
                } else {
                    callback(undefined, buffer);
                }
            });
        })
        .catch((error) => {
            if (this.debug) { this.log("Error reading snapshot at path: " + error); }
            callback(error, undefined);
        });
    } else {
        if (this.debug) { this.log("... using Sharp"); }
        this.sharp(path)
        .resize(request.width, request.height)
        .toBuffer()
        .then((data) => callback(undefined, data))
        .catch((error) => callback(error, undefined));
    }
  }

  public prepareStream(request: StreamRequest, callback: (response: StreamResponse) => void) {
    if (this.debug) { this.log("prepareStream"); }

    const sessionInfo = {} as  SessionInfo;
    const sessionID = request.sessionID;
    const targetAddress = request.targetAddress;

    sessionInfo.address = targetAddress;

    const response = {} as StreamResponse;
    const videoInfo = request.video;

    if (videoInfo) {
        const targetPort: number = videoInfo.port;
        const srtpKey: Uint8Array = videoInfo.srtp_key;
        const srtpSalt: Uint8Array = videoInfo.srtp_salt;

        if (this.debug) { this.log ("srtpKey.length=" + srtpKey.length + ", srtpSalt.length=" + srtpSalt.length); }

        // SSRC is a 32 bit integer that is unique per stream
        const ssrcSource = crypto.randomBytes(4);
        ssrcSource[0] = 0;
        const ssrc = ssrcSource.readInt32BE(0, true);

        this.fps = videoInfo.fps || this.fps;

        const videoResp: VideoResponse = {
            fps: videoInfo.fps,
            height: videoInfo.height,
            max_bit_rate: videoInfo.max_bit_rate,
            port: targetPort,
            srtp_key: srtpKey,
            srtp_salt: srtpSalt,
            ssrc,
            width: videoInfo.width,
        };

        response.video = videoResp;

        sessionInfo.video_port = targetPort;
        sessionInfo.video_srtp = Buffer.concat([srtpKey, srtpSalt]);
        sessionInfo.video_ssrc = ssrc;
    }

    const audioInfo = request.audio;

    if (audioInfo) {
        const targetPort = audioInfo.port;
        const srtpKey = audioInfo.srtp_key;
        const srtpSalt = audioInfo.srtp_salt;

        // SSRC is a 32 bit integer that is unique per stream
        const ssrcSource = crypto.randomBytes(4);
        ssrcSource[0] = 0;
        const ssrc = ssrcSource.readInt32BE(0, true);

        const audioResp: AudioResponse = {
            port: targetPort,
            srtp_key: srtpKey,
            srtp_salt: srtpSalt,
            ssrc,
        };

        response.audio = audioResp;

        sessionInfo.audio_port = targetPort;
        sessionInfo.audio_port = Buffer.concat([srtpKey, srtpSalt]);
        sessionInfo.audio_ssrc = ssrc;
    }

    const currentAddress = ip.address();
    const addressResp: AddressResponse = {
        address: currentAddress,
        type: "v6",
    };

    if (ip.isV4Format(currentAddress)) {
        addressResp.type = "v4";
    }

    response.address = addressResp;
    this.pendingSessions[this.uuid.unparse(sessionID, 0)] = sessionInfo;

    callback(response);
  }

  public handleStreamRequest(request: StreamRequest) {
    if (this.debug) { this.log("handleStreamRequest"); }
    const platform = this;
    const sessionID = request.sessionID;
    const requestType = request.type;
    if (sessionID) {
        const sessionIdentifier = this.uuid.unparse(sessionID, 0);
        const sessionInfo = this.pendingSessions[sessionIdentifier];

        if (requestType === "start" && sessionInfo) {
            let width = 640;
            let height = 640;
            let fps = this.fps || 15;
            let vbitrate = this.maxBitrate;
            const vcodec = this.vcodec || "libx264";
            const packetsize = 1316; // 188 376

            const videoInfo = request.video;
            if (videoInfo) {
                width = videoInfo.width;
                height = videoInfo.height;

                const expectedFPS = videoInfo.fps;
                if (expectedFPS < fps) {
                    fps = expectedFPS;
                }
                if (videoInfo.max_bit_rate < vbitrate) {
                    vbitrate = videoInfo.max_bit_rate;
                }
            }

            const targetAddress = sessionInfo.address;
            const targetVideoPort = sessionInfo.video_port;
            const videoKey = sessionInfo.video_srtp;
            const videoSsrc = sessionInfo.video_ssrc;

            const ffmpegCommand =
            "-threads 0 -an -re -r 1" +
            " " + this.ffmpegSource +
            " -vf fps=" + fps +
            " -map 0:0" +
            " -f mp4 -vcodec " + vcodec +
            " -preset faster" +
            " -pix_fmt yuv420p -an" +
            " -r " + fps +
            " -g " + (fps * 2) +
            " -movflags frag_keyframe+empty_moov -tune stillimage" +
            " -b:v " + vbitrate + "k" +
            " -bufsize " + vbitrate + "k" +
            " -maxrate " + vbitrate + "k" +
            " -payload_type 99" +
            " -ssrc " + videoSsrc +
            " -f rtp" +
            " -srtp_out_suite AES_CM_128_HMAC_SHA1_80" +
            " -srtp_out_params " + videoKey.toString("base64") +
            " srtp://" + targetAddress + ":" + targetVideoPort +
            "?rtcpport=" + targetVideoPort +
            "&localrtcpport=" + targetVideoPort +
            "&pkt_size=" + packetsize;

            const ffmpeg = spawn(this.videoProcessor, ffmpegCommand.split(" "), {env: process.env});
            this.log(
                "Start streaming video from " + this.name + " with " + width + "x" + height + "@" + vbitrate + "kBit");

            if (this.debug) {
                this.log("ffmpeg " + ffmpegCommand);
            }

            ffmpeg.stdout.on("data", function(data) {
                // Do not log to the console if debugging is turned off
                if (platform.debug) {
                    platform.log(data.toString());
                }
            });
            // Always setup hook on stderr.
            // Without this streaming stops within one to two minutes.
            ffmpeg.stderr.on("data", function(data) {
                // Do not log to the console if debugging is turned off
                if (platform.debug) {
                    platform.log(data.toString());
                }
            });
            ffmpeg.on("error", function(error: any) {
                platform.log("An error occurs while making stream request");
                if (platform.debug) {
                    platform.log(error);
                }
            });
            ffmpeg.on("close", (code) => {
                if (code == null || code === 0 || code === 255) {
                    platform.log("Stopped streaming");
                } else {
                    platform.log("ERROR: FFmpeg exited with code " + code);
                    for (const controller of this.streamControllers) {
                        if (controller.sessionIdentifier === sessionID) {
                            controller.forceStop();
                        }
                    }
                }
            });
            this.ongoingSessions[sessionIdentifier] = ffmpeg;

            delete this.pendingSessions[sessionIdentifier];

        } else if (requestType === "stop") {
            const ffmpegProcess = this.ongoingSessions[sessionIdentifier];
            if (ffmpegProcess) {
                ffmpegProcess.kill("SIGTERM");
            }
            delete this.ongoingSessions[sessionIdentifier];
        }
    }
  }

  public createCameraControlService() {
    if (this.service.CameraControl === undefined) {
        throw Error("CameraControl undefined");
    }

    if (this.debug) { this.log("createCameraControlService"); }

    const controlService = new this.service.CameraControl();

    this.services.push(controlService);
    this.cameraControllers.push(controlService);

    if (this.services.filter((s) => s === controlService).length < 1) {
        throw Error ("Failed to register Camera Control Service...");
    }
  }

  // Private
  private _createStreamControllers(maxStreams, options) {

    if (this.debug) { this.log("_createStreamControllers"); }

    for (let i = 0; i < maxStreams; i++) {
        if (this.debug) { this.log("adding StreamController #" + (i + 1) + "/" + maxStreams); }
        const streamController = new this.streamController(i, options, this);

        this.services.push(streamController.service);
        this.streamControllers.push(streamController);
    }

    if (this.debug) { this.log(this.streamControllers.length + "/" + maxStreams + " stream controllers registered"); }
  }
}

export { FFMPEG };
