var common = {};
var EMPTY_BUFFER = new Buffer(0);

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
function encode(data) {
  if (typeof data === 'undefined') {
    return EMPTY_BUFFER;
  }

  return JSON.stringify(data);
}

/**
 * Decodes a frame back into the original type and value.
 */
function decode(frame) {
  if (frame.length === 0) {
    return undefined;
  }

  return JSON.parse(frame);
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
