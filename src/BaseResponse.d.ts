declare class BaseResponse {
    public port: number;
    // tslint:disable-next-line:variable-name
    public srtp_key: Uint8Array;
    // tslint:disable-next-line:variable-name
    public srtp_salt: Uint8Array;
    public ssrc: number;
}

export { BaseResponse };
