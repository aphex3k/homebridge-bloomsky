# Bloomsky Plugin for Homebridge

This plugin for [Homebridge](https://github.com/nfarina/homebridge) will add
your personal Bloomsky weather station to HomeKit. You can shop Bloomsky at [Amazon](https://amzn.to/2PHZc1j) for example.

This plugin will expose the following information for each camera associated with your Bloomsky account:

- Humidity
- Luminance
- Temperature
- Rain Sensor
- Camera

![Preview Image](/preview.jpeg)

## Installation

1. Install ffmpeg on your computer with libx264 or (h264_omx for Raspberry Pi)
1. Make sure your homebridge setup is current.
1. Follow the official [homebridge installation instructions](https://github.com/nfarina/homebridge#installation) if you haven't done so yet
1. Install this plugin using: `npm install -g homebridge-bloomsky`
1. Edit `config.json` and add the platform.
1. Run/Restart Homebridge

### Configuration Example

Add this configuration information to your homebridge `config.json` in the
`platform` section.

```javascript
{
  "platform": "Bloomsky",
  "apiKey": "your-api-key-here==",
  "apiUrl": "https://api.bloomsky.com/api/skydata/",
  "vcodec" : "libx264"
}
```

Property Name | Value | Required
------------- | ----- | --------
`platform` | Must be `Bloomsky` | yes
`apiKey` | Your personal [Bloomsky API](#bloomsky-api) authorization key | yes
`apiUrl` | Use default value for official public Bloomsky API: `https://api.bloomsky.com/api/skydata/` | no
`vcodec` | `libx264` by default, use `h264_omx` for Raspberry Pi | no

## Bloomsky API

The BloomSky API provides the most recent
data from your own devices!
Follow these steps to obtain your own personal Bloomsky API key:
1. Sign in to your Bloomsky account at: https://dashboard.bloomsky.com
1. In the left hand menu, select [Developers](https://dashboard.bloomsky.com/user#api)
1. The pop-up will show your personal API key

## Donations

Donations are very welcome and accepted at the following addresses:
- BTC: `3QTxu56V2gNdq1VznL7ftw3B4megXq5bix`
- LTC: `MFDLN62hMNYDLMAWx4W6Z45nhDDLDjDUV7`

### License Information

> Copyright 2018 Michael Henke
>
> Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
>
>    http://www.apache.org/licenses/LICENSE-2.0
>
> Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.