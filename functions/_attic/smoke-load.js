console.log("A1: start");

console.log("A2: require firebase-functions/v1");
require("firebase-functions/v1");

console.log("A3: require dotenv");
require("dotenv").config();

console.log("A4: require firebase-admin");
require("firebase-admin");

console.log("A5: require axios");
require("axios");

console.log("A6: require date-fns");
require("date-fns");

console.log("A7: done (all requires ok)");
process.exit(0);
