/**
 * intraHouse service plugin
 *
 * E-mail sender
 */

const util = require("util");
const fs = require("fs");

const logger = require("./lib/logger");
const plugin = require("./lib/plugin");

let step = 0;
let unitId = process.argv[2];

plugin.start(unitId);
next();

function next() {
  switch (step) {
    case 0:
      // Request configuration options from IH
      process.send({ type: "get", tablename: "params" });
      break;

    case 1:
      // Subscribe on sendinfo - register as <email> sender
      process.send({
        type: "sub",
        id: "1",
        event: "sendinfo",
        filter: { type: unitId }
      });
      break;

    default:
  }
  step++;
}

process.on("message", message => {
  if (!message) return;

  if (typeof message == "string" && message == "SIGTERM") {
    process.exit();
  }

  if (typeof message == "object" && message.type) {
    parseMessageFromServer(message);
  }
});

function parseMessageFromServer(message) {
  switch (message.type) {
    case "get":
      if (message.params) {
        plugin.setParams(message.params);
        if (message.params.debug) logger.setDebug(message.params.debug);

        // verify SMTP configuration
        plugin.verify(error => {
          if (!error) {
            logger.log("SMTP configuration OK.", "connect");
            next();
          } else {   
            logger.log("SMTP configuration error:" + util.inspect(plugin.smtpOptions));
            process.exit(1);
          }
        });
      }
      break;

    case "sub":
      if (message.error) {
        logger.log("sub error:" + util.inspect(message));
        process.exit(1);
      }

      if (step < 3) next();

      if (message.data && typeof message.data == "object") {
        plugin.sendMail(message.data.txt, message.data.sendTo, plugin.params);
      }
      break;

    case "debug":
      if (message.mode) logger.setDebug(message.mode);
      break;

    default:
      logger.log("Unknown type:" + util.inspect(message));
  }
}

process.on("uncaughtException", function(err) {
  var text = "ERR (uncaughtException): " + util.inspect(err);
  logger.log(text);
});
