import { GarminStick2, StrideSpeedDistanceSensor } from 'ant-plus-next';

const stick = new GarminStick2();

const running = new StrideSpeedDistanceSensor(stick);
running.on('ssdData', data => {
    console.log(JSON.stringify(data));
});

stick.on('startup', () => {
    running.attachSensor(0, 0);
});

await stick.open();

process.on('SIGINT', () => {
    console.log('Caught interrupt signal (Ctrl+C)');
    stick.close();
    // Perform any cleanup or shutdown tasks here
    process.exit();
});