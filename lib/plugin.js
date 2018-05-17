/**
 * plugin.js
 */
const util = require("util");
const qr = require("querystring");
const nodemailer = require("nodemailer");

const logger = require("./logger");
const defsign = "intraHouse";

let sendarr;
let idx;
let mailOptions;
let sendText;
let smtpTransport;

module.exports = {
  params: {
    service: "",
    host: "",
    port: "",
    user: "",
    pass: ""
  },

  start(unitId) {
    this.unitId = unitId;
    logger.log("Plugin " + this.unitId + " has started.", "connect");
  },

  setParams(obj) {
    if (typeof obj == "object") {
      Object.keys(obj).forEach(param => {
        if (this.params[param] != undefined) this.params[param] = obj[param];
      });
    }
  },

  sendToServer(type, data) {
    process.send({ type, data });
  },

  // create reusable transport method (opens pool of SMTP connections)
  sendMail(text, sendTo, opt) {
    if (!sendTo || !opt) return;

    sendText = text;

    // сформировать массив для отсылки, у каждого письма м.б. своя подпись
    sendarr = formSendArray(sendTo);
    logger.log("Mail to send:  " + sendarr.length);
    if (sendarr.length <= 0) return;

    mailOptions = {
      from: (opt.sender ? opt.sender : "IntraHouse") + "<" + opt.user + ">", // sender address
      subject: getFirstWords(sendText, 3),
      to: sendarr[0].addr,
      text: sendText + "\n" + sendarr[0].sign,
      encoding: "utf8"
    };

    try {
      let sobj = getSmtpObj(opt);
      // logger.log("Transport " + util.inspect(sobj), "config");
      smtpTransport = nodemailer.createTransport(sobj);

      if (
        opt.attachments &&
        util.isArray(opt.attachments) &&
        opt.attachments.length > 0
      ) {
        mailOptions.attachments = opt.attachments;
      }

      // send mail with defined transport object
      // logger.log("Mail options  " + util.inspect(mailOptions), "config");
      idx = -1;
      sendnext();
    } catch (e) {
      logger.log(
        "Email sending to " + mailOptions.to + " error: " + getErrorStr(e)
      );
    }
  }
};

function sendnext(error, response) {
  let msg = "";
  idx = idx + 1;

  if (idx > 0) {
    if (error) {
      msg = "Email to " + mailOptions.to + " fail: " + getErrorStr(error);
    } else {
      msg = "Email " + mailOptions.to + " sent, id: " + response.messageId;
    }
    logger.log(msg);
  }

  if (idx < sendarr.length) {
    mailOptions.to = sendarr[idx].addr;
    mailOptions.text = sendText + "\n" + sendarr[idx].sign;

    smtpTransport.sendMail(mailOptions, sendnext);
  } else {
    smtpTransport.close(); // shut down the connection pool, no more messages
    logger.log("Transport closed", "config");
  }
}

function getSmtpObj(opt) {
  let result = {};
  if (!opt.user) throw { message: "Options error: Empty user!" };
  if (!opt.pass) throw { message: "Options error: Empty pass!" };

  result.auth = { user: opt.user, pass: opt.pass };

  if (opt.service) {
    result.service = opt.service;
  } else {
    if (!opt.host) throw { message: "Options error: Empty host!" };
    if (!opt.port) throw { message: "Options error: Empty port!" };
    result.host = opt.host;
    result.port = opt.port;
    result.secureConnection = Number(opt.port) == 465 ? true : false;
    result.requiresAuth = true;
  }

  return result;
}

function formSendArray(sendTo) {
  let arr = [];
  if (typeof sendTo == "object") {
    if (!util.isArray(sendTo)) sendTo = [sendTo];

    sendTo.forEach(item => {
      if (item.addr) {
        arr.push({ addr: item.addr, sign: item.sign || defsign });
      }
    });
  } else {
    arr.push({ addr: sendTo, sign: defsign }); //пришла строка
  }
  return arr;
}

/**
 * Возвращает первые  qwords слов в строке как строку
 * Несколько пробельных символов заменяется одним пробелом. Начальные пробельные символы очищаются
 */
function getFirstWords(astr, qwords) {
  let str = allTrim(astr);
  let n = Number(qwords) > 0 ? Number(qwords) : 1;
  return str
    ? str
        .split(/\s+/)
        .slice(0, n)
        .join(" ")
    : "";
}

/**
 *  Удаление space-символов (пробел, табуляция, новая строка) в начале и конце строки.
 *  [\s] -  то же что и [\n\t\r\f]
 */
function allTrim(str) {
  return str && typeof str === "string"
    ? str.replace(/^\s+/, "").replace(/\s+$/, "")
    : "";
}

function getErrorStr(error) {
  return typeof error == "object"
    ? JSON.stringify(error.errno || error.message)
    : error;
}
