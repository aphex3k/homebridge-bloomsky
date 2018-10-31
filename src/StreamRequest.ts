import { AudioResponse } from "./AudioResponse";
import { VideoResponse } from "./VideoResponse";

declare class StreamRequest {
    public sessionID: any;
    public type: any;
    public video: VideoResponse;
    public targetAddress: string;
    public audio: AudioResponse | undefined;
}

export { StreamRequest };
