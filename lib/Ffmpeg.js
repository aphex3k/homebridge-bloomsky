"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var crypto = require("crypto");
var ip = require("ip");
var FFMPEG = /** @class */ (function () {
    function FFMPEG(uuidgen, service, streamController, cameraConfig, log, videoProcessor) {
        if (uuidgen === undefined) {
            throw Error("UUIDGen undefined");
        }
        if (service === undefined) {
            throw Error("Service undefined");
        }
        if (streamController === undefined) {
            throw Error("StreamController undefined");
        }
        if (log === undefined) {
            throw Error("Log undefined");
        }
        if (cameraConfig.videoConfig.debug) {
            log("FFMPEG constructor");
        }
        this.uuid = uuidgen;
        this.service = service;
        this.streamController = streamController;
        this.log = log;
        var ffmpegOpt = cameraConfig.videoConfig;
        this.name = cameraConfig.name;
        this.vcodec = ffmpegOpt.vcodec;
        this.videoProcessor = videoProcessor || "ffmpeg";
        this.fps = ffmpegOpt.maxFPS || 10;
        this.maxBitrate = ffmpegOpt.maxBitrate || 300;
        this.debug = ffmpegOpt.debug || false;
        if (this.debug) {
            log("Debug loggin enabled...");
        }
        if (!ffmpegOpt.source) {
            throw new Error("Missing source for camera.");
        }
        this.ffmpegSource = ffmpegOpt.source;
        this.ffmpegImageSource = ffmpegOpt.stillImageSource;
        this.services = [];
        this.streamControllers = [];
        this.pendingSessions = {};
        this.ongoingSessions = {};
        var numberOfStreams = ffmpegOpt.maxStreams || 2;
        var videoResolutions = [];
        videoResolutions.push([640, 640, 10]);
        var options = {
            audio: {
                codecs: [],
            },
            proxy: false,
            srtp: true,
            video: {
                codec: {
                    levels: [0, 1, 2],
                    profiles: [0, 1, 2],
                },
                resolutions: videoResolutions,
            },
        };
        this.createCameraControlService();
        this._createStreamControllers(numberOfStreams, options);
    }
    FFMPEG.prototype.handleCloseConnection = function (connectionID) {
        if (this.debug) {
            this.log("closing connection for " + this.streamControllers.length + " stream(s)...");
        }
        this.streamControllers.forEach(function (controller) {
            controller.handleCloseConnection(connectionID);
        });
    };
    FFMPEG.prototype.handleSnapshotRequest = function (request, callback) {
        if (this.debug) {
            this.log("handleSnapshotRequest");
        }
        var platform = this;
        var resolution = request.width + "x" + request.height;
        var imageSource = this.ffmpegImageSource !== undefined ? this.ffmpegImageSource : this.ffmpegSource;
        var ffmpeg = child_process_1.spawn(this.videoProcessor, (imageSource + " -t 1 -s " + resolution + " -f image2 -").split(" "), { env: process.env });
        var imageBuffer = new Buffer(0);
        this.log("Snapshot from " + this.name + " at " + resolution);
        if (this.debug) {
            this.log("ffmpeg " + imageSource + " -t 1 -s " + resolution + " -f image2 -");
        }
        ffmpeg.stdout.on("data", function (data) {
            imageBuffer = Buffer.concat([imageBuffer, data]);
        });
        ffmpeg.on("error", function (error) {
            platform.log("An error occurs while making snapshot request");
            if (platform.debug) {
                platform.log(error);
            }
        });
        ffmpeg.on("close", function (code) {
            callback(undefined, imageBuffer);
        }.bind(this));
    };
    FFMPEG.prototype.prepareStream = function (request, callback) {
        if (this.debug) {
            this.log("prepareStream");
        }
        var sessionInfo = {};
        var sessionID = request.sessionID;
        var targetAddress = request.targetAddress;
        sessionInfo.address = targetAddress;
        var response = {};
        var videoInfo = request.video;
        if (videoInfo) {
            var targetPort = videoInfo.port;
            var srtpKey = videoInfo.srtp_key;
            var srtpSalt = videoInfo.srtp_salt;
            // SSRC is a 32 bit integer that is unique per stream
            var ssrcSource = crypto.randomBytes(4);
            ssrcSource[0] = 0;
            var ssrc = ssrcSource.readInt32BE(0, true);
            var videoResp = {
                port: targetPort,
                srtp_key: srtpKey,
                srtp_salt: srtpSalt,
                ssrc: ssrc,
            };
            response.video = videoResp;
            sessionInfo.video_port = targetPort;
            sessionInfo.video_srtp = Buffer.concat([srtpKey, srtpSalt]);
            sessionInfo.video_ssrc = ssrc;
        }
        var audioInfo = request.audio;
        if (audioInfo) {
            var targetPort = audioInfo.port;
            var srtpKey = audioInfo.srtp_key;
            var srtpSalt = audioInfo.srtp_salt;
            // SSRC is a 32 bit integer that is unique per stream
            var ssrcSource = crypto.randomBytes(4);
            ssrcSource[0] = 0;
            var ssrc = ssrcSource.readInt32BE(0, true);
            var audioResp = {
                port: targetPort,
                srtp_key: srtpKey,
                srtp_salt: srtpSalt,
                ssrc: ssrc,
            };
            response.autio = audioResp;
            sessionInfo.audio_port = targetPort;
            sessionInfo.audio_srtp = Buffer.concat([srtpKey, srtpSalt]);
            sessionInfo.audio_ssrc = ssrc;
        }
        var currentAddress = ip.address();
        var addressResp = {
            address: currentAddress,
            type: "v6",
        };
        if (ip.isV4Format(currentAddress)) {
            addressResp.type = "v4";
        }
        response.address = addressResp;
        this.pendingSessions[this.uuid.unparse(sessionID)] = sessionInfo;
        callback(response);
    };
    FFMPEG.prototype.handleStreamRequest = function (request) {
        var _this = this;
        if (this.debug) {
            this.log("handleStreamRequest");
        }
        var platform = this;
        var sessionID = request.sessionID;
        var requestType = request.type;
        if (sessionID) {
            var sessionIdentifier = this.uuid.unparse(sessionID);
            var sessionInfo = this.pendingSessions[sessionIdentifier];
            if (requestType === "start" && sessionInfo) {
                var width = 640;
                var height = 640;
                var fps = this.fps || 15;
                var vbitrate = this.maxBitrate;
                var abitrate = 32;
                var asamplerate = 16;
                var vcodec = this.vcodec || "libx264";
                var packetsize = 1316; // 188 376
                var videoInfo = request.video;
                if (videoInfo) {
                    width = videoInfo.width;
                    height = videoInfo.height;
                    var expectedFPS = videoInfo.fps;
                    if (expectedFPS < fps) {
                        fps = expectedFPS;
                    }
                    if (videoInfo.max_bit_rate < vbitrate) {
                        vbitrate = videoInfo.max_bit_rate;
                    }
                }
                var targetAddress = sessionInfo.address;
                var targetVideoPort = sessionInfo.video_port;
                var videoKey = sessionInfo.video_srtp;
                var videoSsrc = sessionInfo.video_ssrc;
                var ffmpegCommand = "-threads 0 -an -re -r 1" +
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
                var ffmpeg = child_process_1.spawn(this.videoProcessor, ffmpegCommand.split(" "), { env: process.env });
                this.log("Start streaming video from " + this.name + " with " + width + "x" + height + "@" + vbitrate + "kBit");
                if (this.debug) {
                    this.log("ffmpeg " + ffmpegCommand);
                }
                ffmpeg.stdout.on("data", function (data) {
                    // Do not log to the console if debugging is turned off
                    if (platform.debug) {
                        platform.log(data.toString());
                    }
                });
                // Always setup hook on stderr.
                // Without this streaming stops within one to two minutes.
                ffmpeg.stderr.on("data", function (data) {
                    // Do not log to the console if debugging is turned off
                    if (platform.debug) {
                        platform.log(data.toString());
                    }
                });
                ffmpeg.on("error", function (error) {
                    platform.log("An error occurs while making stream request");
                    if (platform.debug) {
                        platform.log(error);
                    }
                });
                ffmpeg.on("close", function (code) {
                    if (code == null || code === 0 || code === 255) {
                        platform.log("Stopped streaming");
                    }
                    else {
                        platform.log("ERROR: FFmpeg exited with code " + code);
                        for (var _i = 0, _a = _this.streamControllers; _i < _a.length; _i++) {
                            var controller = _a[_i];
                            if (controller.sessionIdentifier === sessionID) {
                                controller.forceStop();
                            }
                        }
                    }
                });
                this.ongoingSessions[sessionIdentifier] = ffmpeg;
                delete this.pendingSessions[sessionIdentifier];
            }
            else if (requestType === "stop") {
                var ffmpegProcess = this.ongoingSessions[sessionIdentifier];
                if (ffmpegProcess) {
                    ffmpegProcess.kill("SIGTERM");
                }
                delete this.ongoingSessions[sessionIdentifier];
            }
        }
    };
    FFMPEG.prototype.createCameraControlService = function () {
        if (this.service.CameraControl === undefined) {
            throw Error("CameraControl undefined");
        }
        if (this.debug) {
            this.log("createCameraControlService");
        }
        var controlService = new this.service.CameraControl();
        this.services.push(controlService);
    };
    // Private
    FFMPEG.prototype._createStreamControllers = function (maxStreams, options) {
        if (this.streamController === undefined) {
            throw Error("StreamController undefined");
        }
        if (this.debug) {
            this.log("_createStreamControllers");
        }
        for (var i = 0; i < maxStreams; i++) {
            var streamController = new this.streamController(i, options, this);
            this.services.push(streamController.service);
            this.streamControllers.push(streamController);
        }
    };
    return FFMPEG;
}());
exports.FFMPEG = FFMPEG;
exports.default = FFMPEG;
