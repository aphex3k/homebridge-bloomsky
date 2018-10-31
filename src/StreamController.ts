declare class StreamController {
    public service: HAPNodeJS.Service;
    public sessionIdentifier: any;
    constructor(identifier: any, options: any, cameraSource: HAPNodeJS.CameraSource);
    public forceStop(): void;
    public handleCloseConnection(connectionID): void;
}

export { StreamController };
