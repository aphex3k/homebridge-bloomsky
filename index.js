'use strict';

const url = require('url');
var Bloomsky = require('./lib/Bloomsky').Bloomsky;

module.exports = function(homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  // Accessory must be created from PlatformAccessory Constructor
  Bloomsky.Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Bloomsky.Service = homebridge.hap.Service;
  Bloomsky.Characteristic = homebridge.hap.Characteristic;
  Bloomsky.Hap = homebridge.hap;
  Bloomsky.UUIDGen = homebridge.hap.uuid;

  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform("homebridge-bloomsky", "Bloomsky", Bloomsky, true);
}
