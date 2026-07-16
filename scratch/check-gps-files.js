const fs = require('fs');

const logFile = 'C:\\Users\\HP\\Desktop\\SMARTBUS_project\\scratch\\gps-log.txt';
const errFile = 'C:\\Users\\HP\\Desktop\\SMARTBUS_project\\scratch\\gps-error.txt';

if (fs.existsSync(logFile)) {
  console.log("LOG EXISTS:", fs.readFileSync(logFile, 'utf8'));
} else {
  console.log("LOG DOES NOT EXIST");
}

if (fs.existsSync(errFile)) {
  console.log("ERR EXISTS:", fs.readFileSync(errFile, 'utf8'));
} else {
  console.log("ERR DOES NOT EXIST");
}
