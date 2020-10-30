import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { LutronHomeworksPlatformAccessory } from './platformAccessory';

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
  private customDevices = {};
  private ignoreDevices;
  private defaultFadeTime = 1;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    if ('customDevices' in this.config) {
      if (Array.isArray(this.config.customDevices)) {
        for( let i = 0; i < this.config.customDevices.length; i++){
          if (typeof this.config.customDevices === 'object'){
            const x = this.config.customDevices[i];
            if('address' in x){
              this.customDevices[x.address] = {};
              if('name' in x){
                this.customDevices[x.address]['name'] = x['name'];
                this.log.debug('Found name ' + x['name'] + ' in customDevice ' + x.address);
              }
              if('fadeTime' in x){
                this.customDevices[x.address]['fadeTime'] = x['fadeTime'];
                this.log.debug('Found fadeTime ' + x['fadeTime'] + ' in customDevice ' + x.address);
              }
            } else{
              this.log.warn('customDevice at index ' + i + 'does not contain an address. Values: ' + this.config.customDevices[i]);
            }
          } else{
            this.log.warn('customDevice at index ' + i + 'is not an object. Values: ' + this.config.customDevices[i]);
          }
        }
      } else {
        log.warn('Error processing customDevices from config. Make sure customDevices is of type Array.');
      }
    }

    log.info(JSON.stringify(this.customDevices));

    if ('ignoreDevices' in this.config) {
      if (Array.isArray(this.config.ignoreDevices)) {
        this.ignoreDevices = this.config.ignoreDevices;
      } else {
        log.warn('Error processing ignoreDevices from config. Make sure ignoreDevices is of type Array.');
      }
    } else{
      this.ignoreDevices = [];
    }

    if ('defaultFadeTime' in this.config){
      if(typeof this.config.defaultFadeTime === 'number'){
        this.defaultFadeTime = this.config.defaultFadeTime;
      } else {
        log.warn('Error processing defaultFadeTime from config. Make sure ignoreDevices is of type number.');
      }
    }

    this.SerialPort = require('serialport');
    this.Readline = require('@serialport/parser-readline');
    this.port = new this.SerialPort(this.config.serialPath, {
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

    if (this.config.loginRequired) {
      this.port.write('LOGIN, ' + this.config.password + '\r');
    }

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

    for (a = 1; a <= 16; a++) {
      for (b = 4; b <= 6; b++) {
        for (c = 1; c <= 4; c++) {
          for (d = 1; d <= 12; d++) {
            for (e = 1; e <= 4; e++) {
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

    // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
    // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
  }

  addDevice(device: string, brightness: number) {
    this.log.debug('Starting initialization for device', device);

    // generate a unique id for the accessory this should be generated from
    // something globally unique, but constant, for example, the device serial
    // number or MAC address
    const uuid = this.api.hap.uuid.generate(device);

    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      if (this.ignoreDevices.includes(device)){
        this.log.info('Found existing device ' + device + ' but is marked as an ignored device. Removing from system.');
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
      } else{
      // the accessory already exists
        this.log.debug('Existing device ' + device + ' not found in ignoreDevices. Adding to system.');
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        // existingAccessory.context.device = device;
        // this.api.updatePlatformAccessories([existingAccessory]);
        this.setContext(existingAccessory, device);
        this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        const accessoryHandler = new LutronHomeworksPlatformAccessory(this, existingAccessory);
        accessoryHandler.updateState(brightness);

        this.devices[device] = accessoryHandler;
      }
    } else {
      if (this.ignoreDevices.includes(device)){
        this.log.info('Found device ' + device + ' but is marked as an ignored device. Ignoring.');
      } else{
      // the accessory does not yet exist, so we need to create it
        this.log.debug('Existing device ' + device + ' not found in ignoreDevices. Adding to system.');
        this.log.info('Adding new accessory:', device);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device, uuid);
        this.setContext(accessory, device);
        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need


        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        const accessoryHandler = new LutronHomeworksPlatformAccessory(this, accessory);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

        accessoryHandler.updateState(brightness);

        this.devices[device] = accessoryHandler;
      }
    }
  }

  updateDevice(address: string, brightness: number) {
    const accessoryHandler = this.devices[address];
    accessoryHandler.updateState(brightness);

  }

  processLine(line: string) {
    if (line.includes('DL, ')) {
      this.log.debug('Recived line:', line);
      const sections = line.split(',');
      const address = sections[1].substring(2, sections[1].length - 1);
      const brightness = parseInt(sections[2]);
      this.log.debug(address + ',', brightness + '%');

      if (address in this.devices) {
        this.log.debug(address, ': Existing device. Updating characteristics.');
        this.updateDevice(address, brightness);
      } else {
        this.log.debug(address, ': New device. Adding to homebridge.');
        this.addDevice(address, brightness);
      }
    }
  }

  setState(device: string, brightness: number, fadeTime: number) {
    this.port.write('FADEDIM, ' + brightness + ', ' + fadeTime + ', 0, [' + device + ']\r');
  }

  setContext(accessory: PlatformAccessory, device: string){
    accessory.context.address = device;

    if ( device in this.customDevices ){
      if('name' in this.customDevices[device]){
        this.log.info('Setting name ' + this.customDevices[device]['name'] + ' to device ' + device);
        accessory.context.name = this.customDevices[device]['name'];
      } else{
        this.log.info('Setting name not set for device ' + device + '. Setting default name.');
        accessory.context.name = device;
      }

      if('fadeTime' in this.customDevices[device]){
        this.log.info('Setting custom fade time ' + this.customDevices[device]['fadeTime'] + ' to device ' + device);
        accessory.context.fadeTime = this.customDevices[device]['fadeTime'];
      } else{
        this.log.info('Setting fadeTime not set for device ' + device + '. Setting default fadeTime.');
        accessory.context.fadeTime = device;
      }
    } else{
      this.log.debug('Device ' + device + ' not found in customDevices. Setting default name and fadeTime.');
    }
  }
}