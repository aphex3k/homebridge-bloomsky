"use strict";

const hap = require("hap-nodejs");
const FFMPEG = require("./lib/Ffmpeg").FFMPEG;

let conf = {
	"username": "CC:22:3D:E3:CE:FF",
	"pin": "876-54-321"
};

console.log("HAP-NodeJS starting...");

hap.init();

const station = {
	"UTC": -7,
	"CityName": "Los Angeles",
	"Storm": {},
	"Searchable": false,
	"DeviceName": "Donna Sky",
	"RegisterTime": 1433814467,
	"DST": 1,
	"BoundedPoint": "",
	"LON": -118.6919183,
	"Point": {},
	"VideoList": [
		"http://s3.amazonaws.com/bskytimelapses/eaB1rJytnZSmmZu1_-7_2018-10-23.mp4",
		"http://s3.amazonaws.com/bskytimelapses/eaB1rJytnZSmmZu1_-7_2018-10-24.mp4",
		"http://s3.amazonaws.com/bskytimelapses/eaB1rJytnZSmmZu1_-7_2018-10-25.mp4",
		"http://s3.amazonaws.com/bskytimelapses/eaB1rJytnZSmmZu1_-7_2018-10-26.mp4",
		"http://s3.amazonaws.com/bskytimelapses/eaB1rJytnZSmmZu1_-7_2018-10-27.mp4"
	],
	"VideoList_C": [
		"http://s3.amazonaws.com/bskytimelapses/eaB1rJytnZSmmZu1_-7_2018-10-23_C.mp4",
		"http://s3.amazonaws.com/bskytimelapses/eaB1rJytnZSmmZu1_-7_2018-10-24_C.mp4",
		"http://s3.amazonaws.com/bskytimelapses/eaB1rJytnZSmmZu1_-7_2018-10-25_C.mp4",
		"http://s3.amazonaws.com/bskytimelapses/eaB1rJytnZSmmZu1_-7_2018-10-26_C.mp4",
		"http://s3.amazonaws.com/bskytimelapses/eaB1rJytnZSmmZu1_-7_2018-10-27_C.mp4"
	],
	"DeviceID": "123456789012",
	"NumOfFollowers": 1,
	"LAT": 34.0201613,
	"ALT": 142,
	"Data": {
		"Luminance": 21,
		"Temperature": 63.61,
		"ImageURL": "http://s3-us-west-1.amazonaws.com/bskyimgs/eaB1rJytnZSmmZu1qJ1lqpWtnpGmmpo=.jpg",
		"TS": 1540697959,
		"Rain": true,
		"Humidity": 99,
		"Pressure": 295.27,
		"DeviceType": "SKY1",
		"Voltage": 2594,
		"Night": true,
		"UVIndex": "1",
		"ImageTS": 1540690225
	},
	"FullAddress": "Pico Blvd, Los Angeles, CA, US",
	"StreetName": "Pico Blvd",
	"PreviewImageList": [
		"http://s3-us-west-1.amazonaws.com/bskyimgs/eaB1rJytnZSmmZu1qJ1lqpWqmJirn54=.jpg",
		"http://s3-us-west-1.amazonaws.com/bskyimgs/eaB1rJytnZSmmZu1qJ1lqpWrlpamm5s=.jpg",
		"http://s3-us-west-1.amazonaws.com/bskyimgs/eaB1rJytnZSmmZu1qJ1lqpWslZOloJg=.jpg",
		"http://s3-us-west-1.amazonaws.com/bskyimgs/eaB1rJytnZSmmZu1qJ1lqpWsnpKompc=.jpg",
		"http://s3-us-west-1.amazonaws.com/bskyimgs/eaB1rJytnZSmmZu1qJ1lqpWtnJSrnZw=.jpg"
	]
};

const uuid = hap.uuid.generate(station.DeviceID);
const cameraAccessory = new hap.Accessory(station.DeviceName, uuid, hap.Accessory.Categories.CAMERA);
const filename = uuid + ".jpg";

const cameraSource = new FFMPEG(hap.uuid, hap, {
	name: uuid,
	videoConfig: {
		debug : true,
		maxHeight: 640,
		maxStreams: 2,
		maxWidth: 640,
		source: "-loop 1 -i " + filename,
		stillImageSource: "-loop 1 -i " + filename,
		vcodec : "h264",
	},
}, console.log, "ffmpeg", filename);
cameraAccessory.configureCameraSource(cameraSource);

cameraAccessory.publish({
	username: conf.username,
	pincode: conf.pin,
	category: hap.Accessory.Categories.CAMERA
}, true);

console.log("Scan this code with your HomeKit App on your iOS device to pair with Camera:");
console.log("                       ");
console.log("    ┌────────────┐     ");
console.log(`    │ ${conf.pin} │     `);
console.log("    └────────────┘     ");
console.log("                       ");
