/// <reference types="node" />
declare class SessionInfo {
    address: any;
    video_port: any;
    video_srtp: Buffer;
    video_ssrc: number;
    audio_port: any;
    audio_ssrc: number;
}
export { SessionInfo };
