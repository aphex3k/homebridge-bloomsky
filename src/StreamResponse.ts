import { AddressResponse } from "./AddressResponse";
import { AudioResponse } from "./AudioResponse";
import { VideoResponse } from "./VideoResponse";

declare class StreamResponse {
    public video: VideoResponse;
    public audio: AudioResponse;
    public address: AddressResponse;
}

export { StreamResponse };
