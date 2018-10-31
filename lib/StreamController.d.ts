declare class StreamController {
    service: HAPNodeJS.Service;
    sessionIdentifier: any;
    constructor(identifier: any, options: any, cameraSource: HAPNodeJS.CameraSource);
    forceStop(): void;
    handleCloseConnection(connectionID: any): void;
}
export { StreamController };
