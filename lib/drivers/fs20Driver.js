/*******************************************************************************
 *  Code contributed to the webinos project
 * 
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *  
 *     http://www.apache.org/licenses/LICENSE-2.0
 *  
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 * Copyright 2013 Toby Ealden
 * 
 ******************************************************************************/


(function () {
  'use strict';

  var fs = require("fs");
  var path = require("path");
  var driverId = null;
  var registerFunc = null;
  var removeFunc = null;
  var callbackFunc = null;
  var CONFIG_PATH = path.join(__dirname,"fht-config.json");
  var configData;
  var fhtMonitor;
  var fs20Device = require("./fs20/fs20Device");
  var started = false;
  var liveDeviceMap = { devices: {} };


  function initialiseDeviceMap(deviceMap) {
    for (var deviceCode in configData.devices) {
      deviceMap.devices[deviceCode] = new fs20Device(deviceCode, configData.devices[deviceCode]);
    }
  }

  function sendDeviceData(device) {
    for (var svc in device.config.services) {
      var data = device.getData(svc);
      if (typeof data !== "undefined") {
        callbackFunc('data', device.config.services[svc].serviceId, data.toFixed(1) );
      }
    }
  }

  function onPacketReceived(timestamp,packet) {
    // Received a new packet - store it.
    var packetDate = new Date(timestamp);

    // Add packet to log file.
    var d = new Date(packetDate.getUTCFullYear(), packetDate.getUTCMonth(), packetDate.getUTCDate(),  packetDate.getUTCHours(), packetDate.getUTCMinutes(), packetDate.getUTCSeconds());
    var logFile = path.join(__dirname,'logs/fhz-' + d.getDate() + '-' + d.getMonth() + '-' + d.getFullYear() + '.log');
    fs.appendFileSync(logFile,d.getTime() + " " + packet.toString() + "\n");

    var adapter = fhtMonitor.getAdapter(packet);
    if (typeof adapter !== "undefined") {
      var deviceCode = adapter.getDeviceCode();
      var deviceList = liveDeviceMap.devices;
      if (deviceCode in deviceList) {
        var fhtInst = deviceList[deviceCode];
        if (adapter.applyTo(fhtInst) === 0) {
          sendDeviceData(fhtInst);
          console.log(adapter.toString());
        }
      } else {
        console.log("ignoring packet for unknown device: " + deviceCode);
        console.log(adapter.toString());
      }
    }
  }

  function start() {
    if (!started) {
      started = true;
      switch (configData.type) {
        case "fhz":
          fhtMonitor = new (require('./fs20/fhz'))(configData.port);
          break;
        case "cul":
          fhtMonitor = new (require('./fs20/cul'))(configData.port);
          break;
        default:
          throw new Error("unknown transceiver type in config.json!");
          break;
      }

      fhtMonitor.on("packet", onPacketReceived);
      fhtMonitor.start();
    }
  }

  exports.init = function(dId, regFunc, remFunc, cbkFunc) {
        console.log('FHT driver init - id is ' + dId);
        driverId = dId;
        registerFunc = regFunc;
        removeFunc = remFunc;
        callbackFunc = cbkFunc;
       intReg();
    };

    exports.execute = function(cmd, eId, data, errorCB, successCB) {
        function initDeviceData(dev) {
          setTimeout(function() { sendDeviceData(dev); }, 2000);
        }
        console.log('FHT driver data - element is ' + eId + ', data is ' + data);
        switch(cmd) {
            case 'cfg':
                //In this case cfg data are transmitted to the sensor/actuator
                //this data is in json(???) format
                console.log('Received cfg for element '+eId+', cfg is '+data);
                successCB(eId);
                break;
            case 'start':
                //In this case the sensor should start data acquisition
                console.log('Received start for element ' + eId + ', mode is '+data);
                for (var dev in liveDeviceMap.devices) {
                  var device = liveDeviceMap.devices[dev];
                  for (var svc in device.config.services) {
                    if (device.config.services[svc].serviceId === eId) {
                      device.running = true;
                      initDeviceData(device);
                      break;
                    }
                  }
                }
                break;
            case 'stop':
                //In this case the sensor should stop data acquisition
                //the parameter data can be ignored
                console.log('Received stop for element '+eId);
                for(var dev in configData.devices) {
                  var device = liveDeviceMap.devices[dev];
                  for (var svc in device.config.services) {
                    if (device.config.services[svc].serviceId === eId) {
                      device.running = false;
                      break;
                    }
                  }
                }
                break;
            case 'value':
                //In this case the actuator should store the value
                //the parameter data is the value to store
                console.log('Received value for element ' + eId + '; value is ' + data);
                break;
            default:
                console.log('FHT driver - unrecognized cmd');
        }
    }

    function intReg() {
        console.log('FHT driver - register sensors');
	      var existsSync = fs.existsSync || path.existsSync;
        if (existsSync(CONFIG_PATH)) {
          configData = JSON.parse(fs.readFileSync(CONFIG_PATH));

          initialiseDeviceMap(liveDeviceMap);

          for (var dev in configData.devices) {
            // Convert device code to hexadecimal
            var device = liveDeviceMap.devices[dev];
            console.log("Adding FS20 device: " + configData.devices[dev].name);

            for (var svc in device.config.services) {
              var svcData = device.config.services[svc];
              var service_info = { type: svcData.subType, name: configData.devices[dev].name + " " + svcData.name, description: svcData.name + " " + svcData.subType + " [" + dev + "]" };
              svcData.serviceId = registerFunc(driverId, svcData.type === "sensor" ? 0 : 1 , service_info);
            }
          }

          start();

        } else {
          console.log("FHT driver - config file not found, no services registered.");
        }
    }

}());
