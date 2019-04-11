/**
 * plugin.js
 */

const util = require("util");
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

  smtpOptions:{},

  start(unitId) {
    this.unitId = unitId;
    logger.log("Plugin " + this.unitId + " has started.", "connect");
  },

  setParams(obj) {
    logger.log("Get params from server:" +util.inspect(obj));
    if (typeof obj == "object") {
      Object.keys(obj).forEach(param => {
        if (this.params[param] != undefined) this.params[param] = obj[param];
      });
    }
  },

  verify(callback) {
    try {
        this.smtpOptions = getSmtpObj(this.params);
        smtpTransport = nodemailer.createTransport(this.smtpOptions);
    } catch (err) {
        callback(err);  
        return;
    }

    smtpTransport.verify(err=> {
        smtpTransport.close();
        callback(err); 
    });
},

  sendMail(text, sendTo, opt, attachments ) {
    if (!sendTo || !opt) return;

    sendText = text;

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
    idx = -1;

    try {

      // create reusable transport method (opens pool of SMTP connections)
      smtpTransport = nodemailer.createTransport(this.smtpOptions);

      if (
        attachments &&
        attachments.length > 0
      ) {
        mailOptions.attachments = attachments;

        logger.log("attachments "+util.inspect(attachments));
        // mailOptions.html = 'Embedded image: <img src="cid:unique@12345"/>';
      }

      sendnext();
    } catch (e) {
      logger.log(
        "Email sending to " + mailOptions.to + " error: " + getErrorStr(e)
      );
    }
  }
};

// send mail with defined transport object
function sendnext(error, response) {
  let logtxt = "";
  idx = idx + 1;

  if (idx > 0) {
    if (error) {
      logtxt = "Email to " + mailOptions.to + " fail: " + getErrorStr(error);
    } else {
      logtxt = "Email " + mailOptions.to + " sent, id: " + response.messageId;
    }
    logger.log(logtxt);
  }

  if (idx < sendarr.length) {
    mailOptions.to = sendarr[idx].addr;
    mailOptions.text = sendText + "\n" + sendarr[idx].sign;

    smtpTransport.sendMail(mailOptions, sendnext);
  } else {
    // shut down the connection pool, no more messages
    smtpTransport.close();
    logger.log("Transport closed", "config");
  }
}

function getSmtpObj(opt) {
  let result = {};
  if (!opt.user) throw { message: "Options error: Empty user!" };
  if (!opt.pass) throw { message: "Options error: Empty pass!" };

  result.auth = { user: opt.user, pass: opt.pass };

  if (opt.service.length > 1) {
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

/**
 *
 * @param {*} sendTo
 *          sendTo as object: { addr:'xx.gmail.com', sign:'With all my love'}
 *          sendTo as array:  [{ addr:'xx.gmail.com', sign:'Best' },{ addr:'zz.mail.com' },...]
 *          sendTo as string: 'xx.gmail.com'
 *
 * @return {Array} with items:{addr, sign}
 */
function formSendArray(sendTo) {
  if (typeof sendTo == "object") {
    if (!util.isArray(sendTo)) sendTo = [sendTo];
  } else if (typeof sendTo == "string") {
    sendTo = [{ addr: sendTo }];
  } else return [];

  return sendTo
    .filter(item => item.addr)
    .map(item => ({ addr: item.addr, sign: item.sign || defsign }));
}

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
