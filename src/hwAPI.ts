import { Logger, PlatformConfig } from 'homebridge';

export class HWAPI {
    
    private finished: boolean;

    constructor(
        private readonly platform: LutronHomeworksPlatform,
        public readonly log: Logger,
        public readonly config: PlatformConfig
    ){
        this.finished = false
        this.log.debug('Finished initializing hwAPI for device', this.config.serialPath);
    }

    get_devices(){
        const SerialPort = require('serialport')
        const Readline = require('@serialport/parser-readline')
        const port = new SerialPort(this.config.serialPath, { 
            baudRate: 115200
        })

        const parser = new Readline()
        port.pipe(parser)

        let results = [] as any;

        this.finished = false
        let func = this;

        parser.on('data', function(line){
            this.platform.
        });

        port.write('RDL, [01:04:01:05:03]\n');
        this.finished = true
        // let results = ['01:04:01:05:03']
    }
}