import { BaseResponse } from "./BaseResponse";

declare class VideoResponse extends BaseResponse{
    width: number;
    height: number;
    fps: number;
    max_bit_rate: number;
}

export { VideoResponse }
