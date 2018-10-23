import { spawn } from "child_process";
import * as crypto from "crypto";
import * as ip from "ip";
import { IService, ISnapshotRequest, IStreamController, IUUIDGen } from "./HAP";
import { ISessionInfo, ISrtpStreamDefinition, IStreamRequest, IStreamResponse } from "./IStreamRequest";

export { FFMPEG };

export default class FFMPEG {
  private uuid: IUUIDGen;
  private service: IService;
  private streamController: any;
  private log: (text: string) => void;
  private name: string;
  private vcodec: string;
  private videoProcessor: string;
  private fps: number;
  private maxBitrate: number;
  private debug: boolean;
  private ffmpegSource: string;
  private ffmpegImageSource: string;
  private services: any[];
  private streamControllers: IStreamController[];
  private pendingSessions: any;
  private ongoingSessions: any;

  constructor(
      uuidgen: IUUIDGen,
      service: IService,
      streamController: IStreamController,
      cameraConfig: any,
      log: (text: string) => void,
      videoProcessor: string) {

    if (uuidgen === undefined) { throw Error("UUIDGen undefined"); }
    if (service === undefined) { throw Error("Service undefined"); }
    if (streamController === undefined) { throw Error("StreamController undefined"); }
    if (log === undefined) { throw Error("Log undefined"); }

    if (cameraConfig.videoConfig.debug) { log("FFMPEG constructor"); }

    this.uuid = uuidgen;
    this.service = service;
    this.streamController = streamController;
    this.log = log;

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

    this.services = [];
    this.streamControllers = [] as IStreamController[];

    this.pendingSessions = {};
    this.ongoingSessions = {};

    const numberOfStreams = ffmpegOpt.maxStreams || 2;
    const videoResolutions =  [] as number[][];

    videoResolutions.push([640, 640, 10]);

    const options = {
        audio: {
            codecs: [],
        },
        proxy: false, // Requires RTP/RTCP MUX Proxy
        srtp: true, // Supports SRTP AES_CM_128_HMAC_SHA1_80 encryption
        video: {
            codec: {
                levels: [0, 1, 2], // Enum, please refer StreamController.VideoCodecParamLevelTypes
                profiles: [0, 1, 2], // Enum, please refer StreamController.VideoCodecParamProfileIDTypes
            },
            resolutions: videoResolutions,
        },
    };

    this.createCameraControlService();
    this._createStreamControllers(numberOfStreams, options);
  }

  public handleCloseConnection(connectionID: any) {
    if (this.debug) { this.log("closing connection for " + this.streamControllers.length + " stream(s)..."); }
    this.streamControllers.forEach(function(controller: IStreamController) {
        controller.handleCloseConnection(connectionID);
    });
  }

  public handleSnapshotRequest(request: ISnapshotRequest, callback: (error: any, Buffer) => void) {
    if (this.debug) { this.log("handleSnapshotRequest"); }

    const platform = this;
    const resolution = request.width + "x" + request.height;
    const imageSource = this.ffmpegImageSource !== undefined ? this.ffmpegImageSource : this.ffmpegSource;
    const ffmpeg = spawn(
        this.videoProcessor, (imageSource + " -t 1 -s " + resolution + " -f image2 -").split(" "), {env: process.env},
    );
    let imageBuffer = new Buffer(0);
    this.log("Snapshot from " + this.name + " at " + resolution);

    if (this.debug) { this.log("ffmpeg " + imageSource + " -t 1 -s " + resolution + " -f image2 -"); }

    ffmpeg.stdout.on("data", function(data) {
        imageBuffer = Buffer.concat([imageBuffer, data]);
    });

    ffmpeg.on("error", function(error: any) {
        platform.log("An error occurs while making snapshot request");
        if (platform.debug) {
            platform.log(error);
        }
    });
    ffmpeg.on("close", function(code) {
        callback(undefined, imageBuffer);
    }.bind(this));
  }

  public prepareStream(request: IStreamRequest, callback: (response: { } ) => void) {
    if (this.debug) { this.log("prepareStream"); }

    const sessionInfo: ISessionInfo = {} as ISessionInfo;
    const sessionID = request.sessionID;
    const targetAddress = request.targetAddress;

    sessionInfo.address = targetAddress;

    const response: IStreamResponse = {} as IStreamResponse;
    const videoInfo: any = request.video;

    if (videoInfo) {
        const targetPort = videoInfo.port;
        const srtpKey = videoInfo.srtp_key;
        const srtpSalt = videoInfo.srtp_salt;

        // SSRC is a 32 bit integer that is unique per stream
        const ssrcSource = crypto.randomBytes(4);
        ssrcSource[0] = 0;
        const ssrc = ssrcSource.readInt32BE(0, true);

        const videoResp = {
            port: targetPort,
            srtp_key: srtpKey,
            srtp_salt: srtpSalt,
            ssrc,
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

        const audioResp: ISrtpStreamDefinition = {
            port: targetPort,
            srtp_key: srtpKey,
            srtp_salt: srtpSalt,
            ssrc,
        };

        response.autio = audioResp;

        sessionInfo.audio_port = targetPort;
        sessionInfo.audio_srtp = Buffer.concat([srtpKey, srtpSalt]);
        sessionInfo.audio_ssrc = ssrc;
    }

    const currentAddress = ip.address();
    const addressResp = {
        address: currentAddress,
        type: "v6",
    };

    if (ip.isV4Format(currentAddress)) {
        addressResp.type = "v4";
    }

    response.address = addressResp;
    this.pendingSessions[this.uuid.unparse(sessionID)] = sessionInfo;

    callback(response);
  }

  public handleStreamRequest(request: IStreamRequest) {
    if (this.debug) { this.log("handleStreamRequest"); }
    const platform = this;
    const sessionID = request.sessionID;
    const requestType = request.type;
    if (sessionID) {
        const sessionIdentifier = this.uuid.unparse(sessionID);
        const sessionInfo = this.pendingSessions[sessionIdentifier];

        if (requestType === "start" && sessionInfo) {
            let width = 640;
            let height = 640;
            let fps = this.fps || 15;
            let vbitrate = this.maxBitrate;
            const abitrate = 32;
            const asamplerate = 16;
            const vcodec = this.vcodec || "libx264";
            const packetsize = 1316; // 188 376

            const videoInfo: any = request.video;
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
            " -vf fps=1" +
            " -map 0:0" +
            " -f mp4 -vcodec " + vcodec +
            " -preset fast" +
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
  }

  // Private
  private _createStreamControllers(maxStreams, options) {
    if (this.streamController === undefined) {
        throw Error("StreamController undefined");
    }

    if (this.debug) { this.log("_createStreamControllers"); }

    for (let i = 0; i < maxStreams; i++) {
        const streamController = new this.streamController(i, options, this);

        this.services.push(streamController.service);
        this.streamControllers.push(streamController);
    }
  }
}
