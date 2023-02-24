import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { LutronHomeworksPlatformAccessory } from './platformAccessory';
import { SerialPort } from 'serialport'
import { ReadlineParser } from '@serialport/parser-readline'

export class LutronHomeworksPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly accessories: PlatformAccessory[] = [];

  private port;
  private parser;
  private deviceHandlers = {};
  private devices = {};
  private ignoreDevices;
  private defaultFadeTime = 1;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    if ('devices' in this.config) {
      if (Array.isArray(this.config.devices)) {
        for (let i = 0; i < this.config.devices.length; i++) {
          if (typeof this.config.devices === 'object') {
            const x = this.config.devices[i];
            if ('address' in x) {
              this.devices[x.address] = {};
              if ('name' in x) {
                this.devices[x.address]['name'] = x['name'];
                this.log.debug('Found name ' + x['name'] + ' in customDevice ' + x.address);
              }
              if ('fadeTime' in x) {
                this.devices[x.address]['fadeTime'] = x['fadeTime'];
                this.log.debug('Found fadeTime ' + x['fadeTime'] + ' in customDevice ' + x.address);
              }
            } else {
              this.log.warn('customDevice at index ' + i + 'does not contain an address. Values: ' + this.config.devices[i]);
            }
          } else {
            this.log.warn('customDevice at index ' + i + 'is not an object. Values: ' + this.config.devices[i]);
          }
        }
      } else {
        log.warn('Error processing devices from config. Make sure devices is of type Array.');
      }
    }

    if ('ignoreDevices' in this.config) {
      if (Array.isArray(this.config.ignoreDevices)) {
        this.ignoreDevices = this.config.ignoreDevices;
      } else {
        log.warn('Error processing ignoreDevices from config. Make sure ignoreDevices is of type Array.');
      }
    } else {
      this.ignoreDevices = [];
    }

    if ('defaultFadeTime' in this.config) {
      if (typeof this.config.defaultFadeTime === 'number') {
        this.defaultFadeTime = this.config.defaultFadeTime;
      } else {
        log.warn('Error processing defaultFadeTime from config. Make sure ignoreDevices is of type number.');
      }
    }

    this.port = new SerialPort({ path: this.config.serialPath as string, baudRate: this.config.baudRate as number ?? 115200 })
    this.parser = new ReadlineParser()
    this.port.pipe(this.parser)

    this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r' }));

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

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.debug('Loading accessory from cache:', accessory.context.name);
    this.accessories.push(accessory);
  }

  discoverDevices() {
    this.log.info('Starting device discovery');
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
    this.log.info('Finished device discovery');
  }

  addDevice(device: string, brightness: number) {
    this.log.debug('Starting initialization for device', device);

    const uuid = this.api.hap.uuid.generate(device);
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      if (this.ignoreDevices.includes(device)) {
        this.log.info('Found existing device %s but is marked as an ignored device. Removing from system.', existingAccessory.context.name);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
      } else {
        this.log.debug('Existing device %s not found in ignoreDevices. Adding to system.', existingAccessory.context.name);
        this.log.debug('Restoring existing accessory from cache: %s', existingAccessory.context.name);

        this.setContext(existingAccessory, device);

        const accessoryHandler = new LutronHomeworksPlatformAccessory(this, existingAccessory);
        accessoryHandler.updateState(brightness);

        this.deviceHandlers[device] = accessoryHandler;
      }
    } else {
      if (this.ignoreDevices.includes(device)) {
        this.log.info('Found device ' + device + ' but is marked as an ignored device. Ignoring.');
      } else {
        this.log.debug('Existing device ' + device + ' not found in ignoreDevices. Adding to system.');
        this.log.info('Adding new accessory:', device);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device, uuid);
        this.setContext(accessory, device);

        const accessoryHandler = new LutronHomeworksPlatformAccessory(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

        accessoryHandler.updateState(brightness);

        this.deviceHandlers[device] = accessoryHandler;
      }
    }
  }

  updateDevice(address: string, brightness: number) {
    const accessoryHandler = this.deviceHandlers[address];
    accessoryHandler.updateState(brightness);

  }

  processLine(line: string) {
    if (line.includes('DL, ')) {
      this.log.debug('Recived line:', line);
      const sections = line.split(',');
      const address = sections[1].substring(2, sections[1].length - 1);
      const brightness = parseInt(sections[2]);
      this.log.debug(address + ',', brightness + '%');

      if (address in this.deviceHandlers) {
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

  setContext(accessory: PlatformAccessory, device: string) {
    accessory.context.address = device;

    if (device in this.devices) {
      if ('name' in this.devices[device]) {
        if (this.devices[device]['name'] !== accessory.context.name) {
          this.log.info('Changing device %s name from %s -> %s', device, accessory.context.name, this.devices[device]['name']);
          accessory.context.name = this.devices[device]['name'];
        } else {
          this.log.debug('Device %s name in context matches name in config. No action taken.');
        }
      } else {
        this.log.debug('Setting name not set for device ' + device + '. Setting default name.');
        accessory.context.name = device;
      }

      if ('fadeTime' in this.devices[device]) {
        if (this.devices[device]['fadeTime'] !== accessory.context.fadeTime) {
          this.log.info('Changing device %s fade time from %s -> %s', 
            device, accessory.context.fadeTime, this.devices[device]['fadeTime']);
          accessory.context.fadeTime = this.devices[device]['fadeTime'];
        } else {
          this.log.debug('Device %s fadeTime in context matches name in config. No action taken.');
        }
      } else {
        this.log.debug('Setting fadeTime not set for device ' + device + '. Setting default fadeTime.');
        accessory.context.fadeTime = this.defaultFadeTime;
      }
    } else {
      this.log.debug('Device ' + device + ' not found in devices. Setting default name and fadeTime.');
      accessory.context.name = device;
      accessory.context.fadeTime = this.defaultFadeTime;
    }

    this.api.updatePlatformAccessories([accessory]);
  }
}