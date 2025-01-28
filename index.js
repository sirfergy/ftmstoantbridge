const noble = require('@abandonware/noble')
const { GarminStick2, Messages } = require('ant-plus-next')

const ftmsFlags = {
    moreData: 1,
    averageSpeed: 1 << 1,
    totalDistance: 1 << 2,
    inclination: 1 << 3,
    elevation: 1 << 4,
    pace: 1 << 5,
    averagePage: 1 << 6,
    expendedEnergy: 1 << 7,
    heartRate: 1 << 8,
    metabolicEquivalent: 1 << 9,
    elapsedTime: 1 << 10,
    remainingTime: 1 << 11,
    force: 1 << 12
}

const stick = new GarminStick2()

let channel = 4;
const deviceId = 12343;
let page = 0;
let tick = 0;
let updateEvent = 0;
let stride_count = 0;

stick.on('startup', () => {
    console.log("Startup")
    console.log("Stick Max Channels:", stick.maxChannels)
    console.log("Stick can Scan:", stick.canScan)

    // startupFE();
    startupSSC();
})

function startupFE() {
    stick.write(Messages.assignChannel(channel, 'transmit'))
    stick.write(Messages.setDevice(channel, deviceId, 0X11, 1))
    stick.write(Messages.setFrequency(channel, 57))
    stick.write(Messages.setPeriod(channel, 8192))
    stick.write(Messages.openChannel(channel))
    console.log('Fitness equipment sensor started')

    stick.on('connection', () => {
        console.log('Connected')
    });

    setInterval(() => {
        broadcastFE(elapsedTime, totalDistance, instantaneousSpeed);
    }, 250)
}

function startupSSC() {
    //const channel = 10;
    console.log(`Channel: ${channel}`)

    stick.write(Messages.assignChannel(channel, 'transmit'))
    stick.write(Messages.setDevice(channel, deviceId, 0x7C, 1))
    stick.write(Messages.setFrequency(channel, 57))
    stick.write(Messages.setPeriod(channel, 8134))
    stick.write(Messages.openChannel(channel))
    console.log('Stride speed and cadence sensor started')

    stick.on('connection', (data) => {
        console.log('Connected')
        console.log(JSON.stringify(data));
    });

    stick.on('channelStatus', (data) => {
        console.log('Channel status');
    });

    stick.on('channelEvent', (data) => {
        console.log('Channel event');
    });

    stick.on('channelResponse', (data) => {
        console.log('Channel response');
        console.log(JSON.stringify(data));
    });
    stick.on('channelId', (data) => {
        console.log('Channel ID');
        console.log(JSON.stringify(data));
    });
    stick.on('eventData', (data) => {
        console.log('Event data');
        console.log(JSON.stringify(data));
    });

    let channelEvent = 0;
    let interval = null;

    /*stick.on('read', (data) => {
        console.log(JSON.stringify(data));

        if (!interval) {
            interval = setInterval(() => {
                broadcastSSC(null, null, totalDistance, null, instantaneousSpeed, null, cadence, null, null)
            }, 250)
        }

        if (data[2] === 0x40) {
            console.log('Received channel event ' + channelEvent++)


            broadcastSSC(null, null, totalDistance, null, instantaneousSpeed, null, cadence, null, null)
        }
    })*/

    cadence = 90;
    instantaneousSpeed = 1.5 / (1 / 256);


    setInterval(() => {
        broadcastSSC(null, null, totalDistance, null, instantaneousSpeed, null, cadence, null, null)
    }, 250)

}

function broadcastFE(elapsedTimeMs, totalDistanceMeters, speedMetersPerS) {
    // console.log(`Broadcasting elapsed time: ${elapsedTimeMs}, instantaneous speed: ${speedMetersPerS}, total distance: ${totalDistanceMeters}`)

    let payload = [];

    if (tick % 132 === 64 || tick % 132 === 65) {
        paylod = [0x50, 0xFF, 0xFF, 0x0A, 0xFF, 0x00, 0x24, 0x01];
    } else if (tick % 132 === 130 || tick % 132 === 131) {
        payload = [0x51, 0xFF, 0x50, 0x0D, 0x02, 0x00, 0x24, 0x01];
    } else if (tick % 66 % 8 === 3 || tick % 66 % 8 === 6) {
        payload = [
            0x11,                                           // general settings page
            0xFF,                                           // reserved
            0xFF,                                           // reserved
            // 215,                                            // cycle length(wheel circumference) - unit 0.01m
            0xFF,                                            // cycle length(wheel circumference) - unit 0.01m
            0x00,                                           // incline LSB - not supported by bike
            0x00,                                           // incline MSB - not supported by bike
            0x00,                                           // resistance level
            0x20                                            // capabilities & FE state
        ]
    } else if (tick % 66 % 8 === 2 || tick % 66 % 8 === 7) {
        accumulatedPower += instantaneousPower;
        accumulatedPower %= 65536

        payload = [
            0x13,                                           // specific stationary bike data (0x19) treadmill (0x13)
            0xFF,                                           // reserved
            0xFF,                                           // reserved
            0xFF,                                           // reserved
            0x90,                                           // cadence
            0x00,                                           // accumulated negative vertical distance
            0x00,                                           // accumulated positive vertical distance
            0x20                                            // capabilities & FE state
        ]

        updateEvent++;
    } else {
        payload = [
            0x10,                                           // general fe data page
            0x13,                                           // equipment type - treadmill
            elapsedTime % 256,                              // time elapsed - unit 0.25s
            totalDistance % 256,                            // distance travelled - unit metres - NOT IMPLEMENTED
            instantaneousSpeed & 0xFF,                      // speed LSB - unit 0.001 m / s
            instantaneousSpeed >> 8,                        // speed MSB - unit 0.001 m / s
            0xFF,                                           // heartrate - unit bpm
            0x20                                            // capabilities & FE state
        ]
    }

    tick++;

    /*
    
        let capabilitiesAndFEState;
        const capabilities = "0100"; // LSB for 7
        const feStateReady = "0010";
        const feStateInUse = "0011";
        const feStatePaused = "0100";
        if (speedMetersPerS == 0 && totalDistanceMeters == 0) {
            capabilitiesAndFEState = parseInt(feStateReady + capabilities, 2);
        } else if (speedMetersPerS > 0) {
            capabilitiesAndFEState = parseInt(feStateInUse + capabilities, 2);
        } else {
            capabilitiesAndFEState = parseInt(feStatePaused + capabilities, 2);
        }
    
        const elapsedTimeInQuarterSeconds = Math.round(elapsedTimeMs / 250) % (64 * 4);
    
        let payload = [];
    
        // ...Messages.intToLEHexArray(0, 2)
    
        if (page === 0 || page === 1) {
            payload.push(channel);
            payload.push(0x10);                                    // 0 Data Page Number
            payload.push(0X13);                                    // 1 Equipment Type
            payload.push(elapsedTimeInQuarterSeconds);             // 2 Elapsed Time (0.25s)
            payload.push(totalDistanceMeters % 256, 1);            // 3 Distance Traveled (meters)
            payload.push((speedMetersPerS * 1000) & 0xFF);         // 4 Speed LSB (0.001m/s)
            payload.push(((speedMetersPerS * 1000) >> 8) & 0xFF);  // 5 Speed LSB (0.001m/s)
            payload.push(0);                                       // 6 Heart Rate
            payload.push(capabilitiesAndFEState);                  // 7 Capabilities / FE State
        } else if (page === 2) {
            //payload.push(channel);
            payload.push(0x11);                                    // 0 Data Page Number
            payload.push(0XFF);                                    // 1 
            payload.push(0XFF);                                    // 2 
            payload.push(0XFF);                                    // 3 
            payload.push(0);                                       // 4 incline
            payload.push(0);                                       // 5 incline LSB
            payload.push(0);                                       // 6 resistance
            payload.push(capabilitiesAndFEState);                  // 7 Capabilities / FE State
        } else {
            payload.push(0x13);                                    // 0 Data Page Number
            payload.push(0XFF);                                    // 1 
            payload.push(0XFF);                                    // 2 
            payload.push(0XFF);                                    // 3 
            payload.push(0);                                       // 4 cadence
            payload.push(0);                                       // 5 
            payload.push(0);                                       // 6 
            payload.push(capabilitiesAndFEState);                  // 7 Capabilities / FE State
        }
    
        page++;
    
        if (page > 3) {
            page = 0;
        }
    */

    stick.write(Messages.broadcastData(channel, payload));

}

function broadcastSSC(time_fractional, time_int, distance_int, byte4dec, speed_fractional, stride, cadence_int, byte4dec2, calories) {
    console.log(`Broadcasting instantaneous speed: ${instantaneousSpeed}, total distance: ${totalDistance}`)

    //speed_fractional = speed_fractional * 0.277778;

    // Page 1 optional Bytes
    time_fractional = 0x00;                             // 1 Set to 0x00 when unused
    time_int = 0x00;                                    // 2 Set to 0x00 when unused
    distance_int = 0x00;                                // 3 Set to 0x00 when unused
    byte4dec = 0x00;
    // Byte 4 is optional set to 0x00 in start.js
    // speed_fractional = 0x00;                            // 5 Set to 0x00 when unused
    //stride = 0x00;
    // cadence_int = 0x00;
    byte4dec2 = 0x00;
    calories = 0x00;

    distance_int = 0x00;
    // nstantaneousSpeed = 1.5 / (1 / 256)

    const now = Date.now();
    const deltaTime = now - lastUpdateTime;
    lastUpdateTime = now;

    // Page 1 optional Bytes
    time_fractional = 0x00;                             // 1 Set to 0x00 when unused
    time_int = 0x00;                                    // 2 Set to 0x00 when unused
    distance_int = 0x00;                                // 3 Set to 0x00 when unused
    // Byte 4 is optional set to 0x00 in start.js
    // speed_fractional = 0x00;                            // 5 Set to 0x00 when unused

    /*
                           payload[0] = (byte) 0x01;
                          payload[1] = (byte) (((lastTime % 256000) / 5) & 0xFF);
                          payload[2] = (byte) ((lastTime % 256000) / 1000);
                          payload[3] = (byte) 0x00;
                          payload[4] = (byte) speedM_s;
                          payload[5] = (byte) ((speedM_s - (double)((int)speedM_s)) / (1.0/256.0));
                          payload[6] = (byte) stride_count++; // bad but it works on zwift
                          payload[7] = (byte) ((double)deltaTime * 0.03125);
    */

    /*

                            payload[0] = (byte) 0x01;
                            payload[1] = (byte) (((lastTime % 256000) / 5) & 0xFF);
                            payload[2] = (byte) ((lastTime % 256000) / 1000);
                            payload[3] = (byte) 0x00;
                            payload[4] = (byte) speedM_s;
                            payload[5] = (byte) ((speedM_s - (double)((int)speedM_s)) / (1.0/256.0));
                            payload[6] = (byte) stride_count;
                            payload[7] = (byte) ((double)deltaTime * 0.03125);

    */

    /*

                            payload[0] = (byte) 0x01;
payload[1] = (byte) (((lastTime % 256000) / 5) & 0xFF);
payload[2] = (byte) ((lastTime % 256000) / 1000);
payload[3] = (byte) 0x00;
payload[4] = (byte) speedM_s;
payload[5] = (byte) ((speedM_s - (double)((int)speedM_s)) / (1.0/256.0));
payload[6] = (byte) stride_count++; // bad but it works on zwift
payload[7] = (byte) ((double)deltaTime * 0.03125);
*/

    let pag1 = [];
    //pag1.push(channel);                            // channel
    pag1.push(0x01);                                    // 0 Data Page Number
    pag1.push(time_fractional);                         // 1 Time Fractional (1/200 sec)
    pag1.push(time_int);                                  // 2 Time Integer (sec)
    pag1.push(0x00);                            // 3 Distance Integer (m)
    pag1.push(0x10);                                // 4 Distance Fractional (1/16 m) + Instantaneous Speed Integer (m/s)
    pag1.push(0x1000 - (0x1000 / (1 / 256)));                        // 5 Instantaneous Speed Fractional (1/256 m/s)
    pag1.push(stride_count++);                                  // 6 Stride count
    pag1.push(0x00);                                    // 7 Update Latency (1/32 sec)

    let pag2 = [];
    // pag2.push(channel);                            // channel
    pag2.push(0x02);                                    // 0 Data Page Number
    pag2.push(0xFF);                                    // 1 Reserved
    pag2.push(0xFF);                                    // 2 Reserved
    pag2.push(cadence_int);                             // 3 Cadence Integer Stride per minute
    pag2.push(byte4dec2);                               // 4 Cadence fractional + Instantaneous Speed - Integer
    pag2.push(speed_fractional);                        // 5 Instantaneous Speed Fractional (1/256 m/s)
    pag2.push(calories);                                // 6 Accumulated calories
    pag2.push(0x80);                                    // 7 Status 10 00 00 00

    //Messages.broadcastData(channel, Messages.buildMessage(pag1, 0x4E));

    //stick.write(Messages.buildMessage(pag1, 0x4E)); //ANT_BROADCAST_DATA
    //stick.write(Messages.buildMessage(pag2, 0x4E)); //ANT_BROADCAST_DATA
    stick.write(Messages.broadcastData(channel, pag1));
    stick.write(Messages.broadcastData(channel, pag2));
}

let elapsedTime = 0;
let totalDistance = 0;
let instantaneousSpeed = 0;
let stride = 0;
let cadence = 0;
let accumulatedPower = 0;
let instantaneousPower = 0;
let lastUpdateTime = Date.now();

let discovered = false;
const enableNoble = false;
if (enableNoble) {
    noble.on('stateChange', (state) => {
        if (enableNoble && state == "poweredOn") {
            noble.startScanning(["1826"], true, (error) => {
                if (error) {
                    console.error(error);
                }
            });
        }
    });

    noble.on('discover', async (peripheral) => {
        if (!discovered && peripheral.advertisement.localName && peripheral.advertisement.localName.includes("HORIZON")) {
            discovered = true;

            await noble.stopScanningAsync()
            await peripheral.connectAsync()

            const { services } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(["1826"], ["2acd"])

            const ftms = services.find(s => s.uuid == "1826")
            const treadmill = ftms.characteristics.find(c => c.uuid.toLowerCase() == "2acd")

            await treadmill.subscribeAsync()

            treadmill.on('data', (data, isNotification) => {
                const flags = data.readUInt16LE()

                if ((flags & ftmsFlags.moreData) !== ftmsFlags.moreData) {
                    instantaneousSpeed = data.readUInt16LE(2);
                    console.log(`Instantaneous speed: ${instantaneousSpeed}, total distance: ${totalDistance}`)
                    return
                }

                const averageSpeed = data.readUInt16LE(2);
                console.log(`Average speed: ${averageSpeed}`)

                totalDistance = data.readUIntLE(4, 3);
                console.log(`Total distance: ${totalDistance}`)

                const inclination = data.readInt16LE(7);
                const rampAngleSetting = data.readInt16LE(9);
                console.log(`Inclination: ${inclination} - ${rampAngleSetting}`)

                const totalEnergy = data.readUInt16LE(11);
                const energyPerHour = data.readUInt16LE(13); // actually total energy
                const energyPerMinute = data.readUIntLE(15, 1);
                console.log(`Expended energy: ${totalEnergy} - ${energyPerHour} - ${energyPerMinute}`)

                const heartRate = data.readUIntLE(16, 1)
                console.log(`Heart rate: ${heartRate}`)

                elapsedTime = data.readUInt16LE(17)
                console.log(`Elapsed time: ${elapsedTime}`)
            })

            /*treadmill.on('data', (data, isNotification) => {
                console.log(`Got data: ${isNotification}`)
                console.log(JSON.stringify(data))
            })*/

            //await peripheral.disconnectAsync();
            //process.exit(0);
        }
    })
}

stick.open();

process.on('SIGINT', () => {
    console.log('Caught interrupt signal (Ctrl+C)');
    stick.close();
    // Perform any cleanup or shutdown tasks here
    process.exit();
});