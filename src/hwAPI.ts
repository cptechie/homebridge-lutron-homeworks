import { Logger, PlatformConfig } from 'homebridge';

export class HWAPI {
    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig
    ){
        this.log.debug('Finished initializing hwAPI for device', this.config.serialPath);
    }

    get_devices(){
        const SerialPort = require('serialport')
        const Readline = require('@serialport/parser-readline')
        const port = new SerialPort(this.config.serialPath, { 
            baudRate: 115200,
            parser: SerialPort.parsers.readline("\n")
        })

        const parser = new Readline()
        port.pipe(parser)

        let results = []

        parser.on('data', function(line){
            if ( line.includes('RDL, ') ) {
                results.push(line);
            }
        });

        port.write('RDL, [01:04:01:05:03]\n');

        // let results = ['01:04:01:05:03']

        return results
    }
}