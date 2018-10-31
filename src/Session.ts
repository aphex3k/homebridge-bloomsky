declare class SessionInfo {
    public address: any;
    // tslint:disable-next-line:variable-name
    public video_port: any;
    // tslint:disable-next-line:variable-name
    public video_srtp: Buffer;
    // tslint:disable-next-line:variable-name
    public video_ssrc: number;
    // tslint:disable-next-line:variable-name
    public audio_port: any;
    // tslint:disable-next-line:variable-name
    public audio_ssrc: number;
}

export { SessionInfo };
