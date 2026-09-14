import qrcode from '/Users/mac/Desktop/Life/node_modules/qrcode-terminal/index.js';
const url = 'exp://192.168.1.72:8081';
console.log('\n--- SCAN WITH EXPO GO (iOS / Android) ---');
qrcode.generate(url, { small: true });
console.log('URL: ' + url + '\n');
