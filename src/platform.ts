import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { LutronHomeworksPlatformAccessory } from './platformAccessory';

import { HWAPI } from './hwAPI';

/**
 * HomebridgePlatforms
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class LutronHomeworksPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  private SerialPort;
  private Readline;
  private port;
  private parser;
  private devices = {};

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    this.SerialPort = require('serialport');
    this.Readline = require('@serialport/parser-readline');
    this.port = new this.SerialPort(this.config.serialPath, { 
      // parser: SerialPort.parsers.readline('\n'),
      baudRate: 115200,
    });
    this.parser = this.port.pipe(new this.Readline({ delimiter: '\r' }));

    this.parser.on('data', data => {
      const line = data.toString('utf8');

      if (
        !line.includes('232') &&
        !line.includes('incorrect') &&
        !line.includes('Invalid') &&
        !line.includes('invalid') &&
        !line.includes('not in database')
      ) {
        this.log.debug(line);
        this.processLine(line);
      }
    });

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    this.port.write('\r');
    this.port.write('DLMON\r');

    let a, b, c, d, e;

    for(a = 1; a <= 16; a++ ){
      for(b = 4; b <= 6; b++ ){
        for(c = 1; c <= 4; c++ ){
          for(d = 1; d <= 12; d++ ){
            for(e = 1; e <= 4; e++ ){
              const address = '[' 
              + a.toString().padStart(2, '0') + ':'
              + b.toString().padStart(2, '0') + ':'
              + c.toString().padStart(2, '0') + ':'
              + d.toString().padStart(2, '0') + ':'
              + e.toString().padStart(2, '0') + ']';
              
              this.port.write('RDL, ' + address + '\r');
            }
          }
        }
      }
    }

    // this.state = 'listen';
    // this.port.write('DLMON\r');

    // parser.on('data', this.log.info);
    // port.write('RDL, [01:04:01:05:03]\n');

    // Read data that is available but keep the stream in "paused mode"
    // port.on('readable', () => {
    //   this.log.info('Data Readable:', port.read().toString('utf8'));
    // });

    // // Switches the port into "flowing mode"
    // port.on('data', (data) => {
    //   // this.log.info('Data Buffer:', data);
    //   this.log.info('Data String:', data.toString('utf8'));
    // });

    

    // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
    // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
  }

  // this.log.info(xml);
  /*
    const convert = require('xml-js');
    let result = JSON.parse(convert.xml2json(xml, {compact: true, spaces: 4}));

    // this.log.info(keypads);
    for (const device of result.Project.HWKeypad){

      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.Address._text);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        // existingAccessory.context.device = device;
        // this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new LutronHomeworksPlatformAccessory(this, existingAccessory);

      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.Name._text);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.Name._text, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;
        accessory.context.address = device.Address._text;
        accessory.context.name = device.Name._text;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        new LutronHomeworksPlatformAccessory(this, accessory);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }

      // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
      // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
    */

  addDevice(device: string, brightness: number){
    this.log.debug('Starting initialization for device', device);

    // generate a unique id for the accessory this should be generated from
    // something globally unique, but constant, for example, the device serial
    // number or MAC address
    const uuid = this.api.hap.uuid.generate(device);

    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      // the accessory already exists
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

      // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
      // existingAccessory.context.device = device;
      // this.api.updatePlatformAccessories([existingAccessory]);

      // create the accessory handler for the restored accessory
      // this is imported from `platformAccessory.ts`
      const accessoryHandler = new LutronHomeworksPlatformAccessory(this, existingAccessory);

      accessoryHandler.setOn( brightness !== 0 ? true : false, (error)=> {
        accessoryHandler.setBrightness(brightness, (error)=> {
          //pass
        });
      });

      this.devices[device] = accessoryHandler;


    } else {
      // the accessory does not yet exist, so we need to create it
      this.log.info('Adding new accessory:', device);

      // create a new accessory
      const accessory = new this.api.platformAccessory(device, uuid);

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.context.address = device;

      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      const accessoryHandler = new LutronHomeworksPlatformAccessory(this, accessory);

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

      accessoryHandler.setOn( brightness !== 0 ? true : false, (error)=> {
        accessoryHandler.setBrightness(brightness, (error)=> {
          //pass
        });
      });

      this.devices[device] = accessoryHandler;
    }
  }

  updateDevice(address: string, brightness: number){
    const accessoryHandler = this.devices[address];

    accessoryHandler.setOn( brightness !== 0 ? true : false, (error)=> {
      accessoryHandler.setBrightness(brightness, (error)=> {
        //pass
      });
    });

    this.port.write('\r');
  }

  processLine(line: string){
    if (line.includes('DL, ')){
      this.log.debug('Recived line:', line);
      const sections = line.split(',');
      const address = sections[1].substring(2, sections[1].length - 1);
      const brightness = parseInt(sections[2]);
      this.log.debug(address + ',', brightness + '%');

      if( address in this.devices){
        this.log.debug(address, ': Existing device. Updating characteristics.');
        this.updateDevice(address, brightness);
      } else{
        this.log.debug(address, ' : New device. Adding to homebridge.');
        this.addDevice(address, brightness);
      }
      // switch(this.state){
      //   case 'discovery': 
      //     this.addDevice(address, brightness);
      //     break;
      //   case 'listen':
      //     this.addDevice(address, brightness);
      // }
      
    }
  }

  setState(device: string, brightness: number){
    this.port.write('FADEDIM, ' + brightness + ', 0, 0, [' + device + ']\r');
  }
}

