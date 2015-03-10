/**
 * TODO: Description.
 */
var debug = require('debug')('services:Registry');
var discovery = require('discovery');
var ip = require('ip');
var messaging = require('messaging');
var mi = require('mi');
var when = require('when');
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

  this.sockets = {};
  this._pending = {};
  this._services = {};

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

  Object.keys(self.sockets)
    .forEach(function (id) {
      self.sockets[id].close();
    });

  Object.keys(self._services)
    .forEach(function (id) {
      self._services[id].destroy();
    });

  return self;
};

/**
 * TODO: Description.
 */
Registry.prototype.createService = function createService(name) {
  var self = this;
  var service = Service.create(self, name);

  self._services[name] = service;

  return service;
};

/**
 * TODO: Description.
 */
Registry.prototype.request = function request(command, data) {
  var self = this;

  // HACK(schoon) - Frame command into the request.
  command = command.split(':');
  var name = command.shift();
  command = command.join(':');

  debug('REQUEST %s %s %j', name, command, data);

  // TODO(schoon) - Send along command for filtering.
  // TODO(schoon) - Do we assume uniform service instances?

  // TODO(schoon) - Consolidate socket creation code.
  if (!self.sockets[name]) {
    self.createSocket(name);
  }

  var requestId = Math.random().toString().slice(2);

  // TODO(schoon) - Throw if no connections, or enqueue to HWM as normal?
  self.sockets[name].write([requestId, command, JSON.stringify(data)])

  return when.promise(function (resolve, reject) {
    self._pending[requestId] = {
      resolve: resolve,
      reject: reject
    };
  });
};

/**
 * TODO: Description.
 */
Registry.prototype.createSocket = function createSocket(name) {
  var self = this;

  self.sockets[name] = messaging.Dealer.create();

  self.sockets[name].on('data', function (message) {
    var requestId = message[0];
    var err = JSON.parse(message[1]);
    var data;

    if (message[2].length) {
      data = JSON.parse(message[2]);
    }

    if (err) {
      self._pending[requestId].reject(err);
      return;
    }

    self._pending[requestId].resolve(data);
  });

  self.sockets[name].on('error', function (err) {
    debug('Error in %s client:', name, err);
  });

  self.sockets[name].on('end', function () {
    debug('Disconnected %s.', name);
  });

  return self;
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

    if (!_url) {
      return;
    }

    if (!self.sockets[name]) {
      self.createSocket(name);
    }

    debug('Connecting to %s', _url);
    self.sockets[name].connect(_url);
  }

  function disconnectFromService(name, service) {
    var _url = service.data.url;

    if (!_url || !self.sockets[name]) {
      return;
    }

    debug('Disconnecting from %s', _url);
    self.sockets[name].disconnect(_url);
  }
};

/*!
 * Export `Registry`.
 */
module.exports = Registry;
