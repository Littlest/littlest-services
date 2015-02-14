/**
 * TODO: Description.
 */
var url = require('url');
var axon = require('axon');
var debug = require('debug')('services:Registry');
var discovery = require('discovery');
var ip = require('ip');
var mi = require('mi');

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

  return self;
};

/**
 * TODO: Description.
 */
Registry.prototype.createService = function createService(name) {
  var self = this;
  var socket = axon.socket('rep').bind(0);
  // TODO(schoon) - Add first-party `type` to `discovery`.
  var _service = discovery.Registry.prototype.createService.call(this, name, { url: null });

  socket.on('bind', function () {
    _service.update({
      url: url.format({
        protocol: 'tcp:',
        slashes: true,
        hostname: ip.address(),
        port: socket.address().port
      })
    });
  });

  // TODO(schoon) - Class?
  var service = {
    handle: function handle(command, fn) {
      debug('HANDLE %s', command);

      socket.on('message', function (data, callback) {
        // TODO(schoon) - Filter.
        // TODO(schoon) - Promise.
        var result = fn.call(service, data);
        callback(result);
      });

      return service;
    },
    request: function request(command, data) {
      return self.request(command, data);
    }
  };

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
    self.sockets[name] = axon.socket('req');
    self.sockets[name].set('hwm', 100);
  }

  // TODO(schoon) - Throw if no connections, or enqueue to HWM as normal?
  self.sockets[name].send(data, function (result) {
    // TODO(schoon) - Promise?
    debug('RESPONSE %j', result);
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
      self.sockets[name] = axon.socket('req');
      self.sockets[name].set('hwm', 100);
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

    _url = url.parse(_url);

    // debug('SOCKS: %s', self.sockets[name].socks.length);

    self.sockets[name].socks
      .forEach(function (socket) {
        var address = socket.address();

        // debug('SOCKET %j', address);

        if (address.address === _url.hostname && address.port === _url.port) {
          debug('Disconnecting socket at %s', url.format(_url));
          socket.destroy();
        }
      });
  }
};

/*!
 * Export `Registry`.
 */
module.exports = Registry;
