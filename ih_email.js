/**
 * ih_email.js
 * Сервисный плагин для SMS
 * 
 */
const util = require("util");
const fs = require("fs");


const logger = require("./lib/logger");
const plugin = require("./lib/plugin");

let step = 0;
plugin.start(process.argv[2]);
next();

function next() {
  switch (step) {
    case 0:
      // Получить параметры почтового сервера и опции 
      getTable("params");
      step = 1;
      break;

    case 1:
      // Подписка на событие send
      process.send({ type: "sub", id:"1",  event:"send", filter:{type:"email"}  });
      step = 2;
      break;
    
    case 2:
       // Подписка подтверждена - основный цикл  
       step = 3;
       break;

    default:
  }
}

function getTable(name) {
  process.send({ type: "get", tablename: name });
}


/******************************** Входящие от IH ****************************************************/
process.on("message", function(message) {
  if (!message) return;
  if (typeof message == "string") {
    if (message == "SIGTERM") {
      process.exit();
    }
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
        next();
      }
      break;

    case "sub":
      // Ошибка подписки - выходим!
       if (message.error) {      
           logger.log('sub error:' + util.inspect(message));
           process.exit(1);
       }

       // Подтверждение подписки
       if (step < 3) next();

       if (message.data && typeof message.data == 'object') {
           plugin.sendMail(message.data.txt, message.data.sendTo, plugin.params);
       }   

       break;

    case "debug":
      if (message.mode) logger.setDebug(message.mode);
      break;

    default:
  }
}

process.on("uncaughtException", function(err) {
  var text = "ERR (uncaughtException): " + util.inspect(err);
  logger.log(text);
});
