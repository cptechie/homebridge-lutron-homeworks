import { Logger, PlatformConfig } from 'homebridge';

export class HWAPI {
    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig
    ){
        this.log.debug('Finished initializing hwAPI for device ', this.serialPath);
    }
}