const noble = require('@abandonware/noble')

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
};

noble.on('stateChange', (state) => {
    if (state == "poweredOn") {
        noble.startScanning(["1826"], true, (error) => {
            if (error) {
                console.error(error);
            }
        });
    }
});

let discovered = false;
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
                const speed = data.readUInt16LE(2);
                console.log(`Instantaneous speed: ${speed}`)
                return
            }

            const averageSpeed = data.readUInt16LE(2);
            console.log(`Average speed: ${averageSpeed}`)

            const totalDistance = data.readUIntLE(4, 3);
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

            const elapsedTime = data.readUInt16LE(17)
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