import { URL } from "url";

declare interface Station {
  DeviceID: string;
  DeviceName: string;
  Data: StationData;
}

declare interface StationData {
  Temperature: number;
  Luminance: number;
  Humidity: number;
  Rain: boolean;
  Night: boolean;
  Voltage: number;
  DeviceType: string;
  ImageURL: URL;
}
