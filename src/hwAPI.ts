import { Logger, PlatformConfig } from 'homebridge';
import { LutronHomeworksPlatform } from './platform'; 


export class HWAPI {
    
    private finished: boolean;

    constructor(
      private readonly platform: LutronHomeworksPlatform,
      public readonly log: Logger,
      public readonly config: PlatformConfig,
    ){
      this.finished = false;
      this.log.debug('Finished initializing hwAPI for device', this.config.serialPath);
    }

    get_devices(){
      const serialIo = require('serial-io');
      const conn = serialIo.send(this.config.serialPath, 'RDL, [01:04:01:05:03]\n', {baudRate: 115200, timeoutRolling: 1000})
        .then(response => this.log.debug(response));

      this.log.debug('Type of variable, ', typeof conn);

    }
}