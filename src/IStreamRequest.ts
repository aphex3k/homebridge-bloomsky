export declare interface IStreamRequest {
    sessionID: string;
    targetAddress: string;
    video: string;
    audio: ISrtpStreamDefinition;
    type: string;
}

export declare interface IStreamResponse {
    video: ISrtpStreamDefinition;
    autio: ISrtpStreamDefinition;
    address: { address: string; type: string; };
}

export declare interface ISrtpStreamDefinition {
    port: number;
    srtp_key: Uint8Array;
    srtp_salt: Uint8Array;
    ssrc: number;
}

export declare interface ISessionInfo {
    address: string;
    video_port: number;
    video_srtp: Buffer;
    video_ssrc: number;
    audio_port: number;
    audio_srtp: Buffer;
    audio_ssrc: number;
}
