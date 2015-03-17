var msgpack = require('msgpack5')();
var common = {};
var EMPTY_BUFFER = new Buffer(0);

// Initialize msgpack with custom types.
// TODO(schoon) - Expose an interface to replace byte-level encoding (e.g.
// JSON, BSON, Object.toString, etc.)
var customType = 0x00;
msgpack.register(customType++, Date,
  function encodeDate(date) { return date.toString(); },
  function decodeDate(buf) { return new Date(String(buf)); }
);
msgpack.register(customType++, RegExp,
  function encodeRegExp(regex) { return regex.toString(); },
  function decodeRegExp(buf) { return new RegExp(String(buf)); }
);
msgpack.register(customType++, Function,
  function encodeFunction(func) {
    var r = /^function[\s]+[^\s(]+[\s]*\((.*)\)[\s]*{(.*)}$/;
    var parsed = r.exec(func.toString());
    return msgpack.encode(
      parsed[1]
        .split(',')
        .map(function (str) { return str.trim(); })
        .concat(parsed[2])
    );
  },
  function decodeFunction(buf) {
    return Function.apply(null, msgpack.decode(buf));
  }
);
msgpack.register(customType++, TypeError,
  function encodeTypeError(err) { return err.message; },
  function decodeTypeError(buf) { return new TypeError(String(buf)); }
);
msgpack.register(customType++, ReferenceError,
  function encodeReferenceError(err) { return err.message; },
  function decodeReferenceError(buf) { return new ReferenceError(String(buf)); }
);
msgpack.register(customType++, RangeError,
  function encodeRangeError(err) { return err.message; },
  function decodeRangeError(buf) { return new RangeError(String(buf)); }
);
msgpack.register(customType++, SyntaxError,
  function encodeSyntaxError(err) { return err.message; },
  function decodeSyntaxError(buf) { return new SyntaxError(String(buf)); }
);
msgpack.register(customType++, Error,
  function encodeError(err) { return err.message; },
  function decodeError(buf) { return new Error(String(buf)); }
);

/**
 * Generates a random ID unique enough to differentiate between any pending
 * requests.
 */
common.generateRequestId = generateRequestId;
function generateRequestId() {
  return Math.random().toString().slice(2);
}

/**
 * Encodes a single value for sending. Should preserve both type and value.
 */
common.encode = encode;
function encode(data) {
  if (typeof data === 'undefined') {
    return EMPTY_BUFFER;
  }

  return msgpack.encode(data);
}

/**
 * Decodes a frame back into the original type and value.
 */
common.decode = decode;
function decode(frame) {
  if (frame.length === 0) {
    return undefined;
  }

  return msgpack.decode(frame);
}

/**
 * Builds a Message from a Request: `requestId`, `command`, and `data`.
 */
common.buildRequestMessage = buildRequestMessage;
function buildRequestMessage(request) {
  return [String(request.requestId), String(request.command), encode(request.data)];
}

/**
 * Restores a Request from a received Message. Only `command` and `data`
 * should be relied upon, as all other fields should be passed into
 * `buildResponseMessage` unchanged.
 */
common.parseRequestMessage = parseRequestMessage;
function parseRequestMessage(message) {
  return {
    identity: message[0],
    requestId: message[1],
    command: String(message[2]),
    data: decode(message[3])
  };
}

/**
 * Builds a Message from a Response: `error`, `data`, and any received Request
 * values.
 */
common.buildResponseMessage = buildResponseMessage;
function buildResponseMessage(response) {
  return [response.identity, response.requestId, encode(response.error), encode(response.data)];
}

/**
 * Restores a Response from a received Message, including the original
 * `requestId` and the received `error` and `data`.
 */
common.parseResponseMessage = parseResponseMessage;
function parseResponseMessage(message) {
  return {
    requestId: String(message[0]),
    error: decode(message[1]),
    data: decode(message[2])
  };
}

/*!
 * Export `common`.
 */
module.exports = common;
