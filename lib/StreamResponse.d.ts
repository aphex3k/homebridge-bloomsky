import { AddressResponse } from "./AddressResponse";
import { AudioResponse } from "./AudioResponse";
import { VideoResponse } from "./VideoResponse";
declare class StreamResponse {
    video: VideoResponse;
    audio: AudioResponse;
    address: AddressResponse;
}
export { StreamResponse };
