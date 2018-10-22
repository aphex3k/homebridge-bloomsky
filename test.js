var expect = require('chai').expect;
var Bloomsky = require('./index.js');

const _mockHomebridge = {
    "version":"2.2",
    "platformAccessory": null,
    "hap": {
        "Service" : null,
        "Characteristic" : null,
        "uuid" : function (textInput) { return textInput; }
    },
    "registerPlatform": function(a,b,c,d) { return d == true; },
    "log": function(logText) { return console.log(logText); },
    "config": {

    },
    "api": null
};

describe('Mock Homebridge', function () {
  it('should provide mock functionality', function () {

    expect(_mockHomebridge).to.not.be.equal(null);
    expect(_mockHomebridge).to.not.be.equal(undefined);

    expect(_mockHomebridge.version).to.not.be.equal(null);
    expect(_mockHomebridge.version).to.not.be.equal(undefined);

    expect(_mockHomebridge.hap).to.not.be.equal(null);
    expect(_mockHomebridge.hap).to.not.be.equal(undefined);

    expect(_mockHomebridge.registerPlatform).to.not.be.equal(null);
    expect(_mockHomebridge.registerPlatform).to.not.be.equal(undefined);

    expect(_mockHomebridge.log).to.not.be.equal(null);
    expect(_mockHomebridge.log).to.not.be.equal(undefined);

    expect(_mockHomebridge.config).to.not.be.equal(null);
    expect(_mockHomebridge.config).to.not.be.equal(undefined);

    expect(_mockHomebridge.hap.uuid).to.not.be.equal(null);
    expect(_mockHomebridge.hap.uuid).to.not.be.equal(undefined);
  });
});


describe('Bloomsky', function () {
  it('constructor should create a new instance', function () {

    let bloomsky = new Bloomsky(_mockHomebridge);

    expect(bloomsky).to.not.be.equal(null);
    expect(bloomsky).to.not.be.equal(undefined);
  });
});
