const noble = require('noble')

noble.on('stateChange', (state) => {
    if (state == "poweredOn") {
        noble.startScanning([], true, (error) => {
            console.log(error);
        });
    }
});


