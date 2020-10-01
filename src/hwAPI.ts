import { Logger, PlatformConfig } from 'homebridge';

export class HWAPI {
    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig
    ){
        this.log.debug('Finished initializing hwAPI for device', this.config.serialPath);
    }

    get_devices(){
        let results = ['01:04:01:05:03']

        return results
    }
}