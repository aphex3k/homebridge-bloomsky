import { AudioResponse } from "./AudioResponse";
import { VideoResponse } from "./VideoResponse";
declare class StreamRequest {
    sessionID: any;
    type: any;
    video: VideoResponse;
    targetAddress: string;
    audio: AudioResponse | undefined;
}
export { StreamRequest };
