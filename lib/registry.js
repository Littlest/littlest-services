/**
 * TODO: Description.
 */
var debug = require('debug')('services:Registry');
var discovery = require('discovery');
var ip = require('ip');
var onemq = require('onemq');
var mi = require('mi');
var when = require('when');
var common = require('./common');
var Service = require('./service');

/**
 * Creates a new instance of Registry with the provided `options`.
 *
 * @param {Object} options
 */
function Registry(options) {
  if (!(this instanceof Registry)) {
    return new Registry(options);
  }

  options = options || {};

  discovery.Registry.call(this, options);

  // TODO(schoon) - Consolidate models with `discovery`.

  this.clients = {};
  this._pendingRequests = {};

  this._initEventHandlers();
}
mi.inherit(Registry, discovery.Registry);
Registry.createRegistry = Registry;

/**
 * TODO: Description.
 */
Registry.prototype.destroy = function destroy() {
  var self = this;

  discovery.Registry.prototype.destroy.call(this);

  Object.keys(self.clients)
    .forEach(function (id) {
      self.clients[id].close();
    });

  Object.keys(self.services)
    .forEach(function (id) {
      if (self.services[id].local) {
        self.services[id].destroy();
      }
    });

  return self;
};

/**
 * TODO: Description.
 */
Registry.prototype.createService = function createService(name) {
  return Service.create(this, name);
};

/**
 * TODO: Description.
 */
Registry.prototype.request = function request(command, data) {
  var self = this;

  command = command.split(':');
  var name = command.shift();
  command = command.join(':');

  debug('REQUEST %s %s %j', name, command, data);

  // TODO(schoon) - Do we assume uniform service instances?

  var client = self.ensureClient(name);
  var requestId = common.generateRequestId();

  client.write(common.buildRequestMessage({
    requestId: requestId,
    command: command,
    data: data
  }));

  return when.promise(function (resolve, reject) {
    self._pendingRequests[requestId] = {
      resolve: resolve,
      reject: reject
    };
  });
};

/**
 * TODO: Description.
 */
Registry.prototype.ensureClient = function ensureClient(name) {
  var self = this;

  if (self.clients[name]) {
    return self.clients[name];
  }

  self.clients[name] = onemq.Dealer.create();

  self.clients[name].on('data', function (message) {
    var response = common.parseResponseMessage(message);
    var pending = self._pendingRequests[response.requestId];

    if (response.error) {
      pending.reject(response.error);
      return;
    }

    pending.resolve(response.data);
  });

  self.clients[name].on('error', function (err) {
    debug('Error in %s client:', name, err);
  });

  self.clients[name].on('end', function () {
    debug('Disconnected %s.', name);
  });

  Object.keys(self.services).forEach(function (id) {
    if (self.services[id].name === name && self.services[id].data.url) {
      self.clients[name].connect(self.services[id].data.url);
    }
  });

  return self.clients[name];
};

/**
 * TODO: Description.
 */
Registry.prototype._initEventHandlers = function _initEventHandlers() {
  var self = this;

  // TODO(schoon) - These events should queue up changes to be applied a little
  // later (next tick? 10 ms?).

  self.on('available', connectToService);
  self.on('unavailable', disconnectFromService);
  self.on('update', function (name, service) {
    // TODO(schoon) - Reconnect only on change.
    disconnectFromService(name, service);
    connectToService(name, service);
  });

  return self;

  function connectToService(name, service) {
    var _url = service.data.url;
    var client = self.clients[name];

    if (!_url || !client) {
      return;
    }

    debug('Connecting to %s', _url);
    client.connect(_url);
  }

  function disconnectFromService(name, service) {
    var _url = service.data.url;
    var client = self.clients[name];

    if (!_url || !client) {
      return;
    }

    debug('Disconnecting from %s', _url);
    client.disconnect(_url);
  }
};

/*!
 * Export `Registry`.
 */
module.exports = Registry;
