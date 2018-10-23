import { IService, ISnapshotRequest, IStreamController, IUUIDGen } from "./HAP";
import { IStreamRequest } from "./IStreamRequest";
export { FFMPEG };
export default class FFMPEG {
    private uuid;
    private service;
    private streamController;
    private log;
    private name;
    private vcodec;
    private videoProcessor;
    private fps;
    private maxBitrate;
    private debug;
    private ffmpegSource;
    private ffmpegImageSource;
    private services;
    private streamControllers;
    private pendingSessions;
    private ongoingSessions;
    constructor(uuidgen: IUUIDGen, service: IService, streamController: IStreamController, cameraConfig: any, log: (text: string) => void, videoProcessor: string);
    handleCloseConnection(connectionID: any): void;
    handleSnapshotRequest(request: ISnapshotRequest, callback: (error: any, Buffer: any) => void): void;
    prepareStream(request: IStreamRequest, callback: (response: {}) => void): void;
    handleStreamRequest(request: IStreamRequest): void;
    createCameraControlService(): void;
    private _createStreamControllers;
}
