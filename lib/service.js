/**
 * TODO: Description.
 */
var events = require('events');
var debug = require('debug')('services:Service');
var discovery = require('discovery');
var messaging = require('messaging');
var mi = require('mi');

/**
 * Internal "constructor".
 */
function Service() {
  this._router = messaging.Router.create();
  this._dealer = messaging.Router.create();
  this._bus = new events.EventEmitter();

  this._initEvents();
}
mi.inherit(Service, discovery.Service);

/**
 * TODO: Description.
 */
Service.create = function create(registry, name) {
  var cls = this
    , service = discovery.Registry.prototype.createService.call(registry, name, { url: null });

  debug('Destroying Service %s.', name);

  // Since `discovery` does not (yet) allow defining a subclass of Service
  // for tracking, we have to extend the Service this way.
  service.__proto__ = cls.prototype;
  cls.call(service);
  service._registry = registry;
  service.name = name;

  return service;
};

/**
 * TODO: Description.
 */
Service.prototype.destroy = function destroy() {
  this._router.close();
  this._dealer.close();

  debug('Destroying Service %s.', this.name);

  return this;
};

/**
 * TODO: Description.
 */
Service.prototype.handle = function handle(name, fn) {
  var self = this;

  // TODO(schoon) - Multiple handlers.
  self._bus.on(name, function (data, callback) {
    fn(data, callback);
  });

  return self;
};

/**
 * TODO: Description.
 */
Service.prototype.request = function request(name, data) {
  var self = this;

  self._registry.request(name, data);

  return self;
};

/**
 * TODO: Description.
 */
Service.prototype._initEvents = function _initEvents() {
  var self = this;

  self._router.bind('tcp://*:*')

  self._router.on('listening', function (endpoint) {
    // TODO(schoon) - Consolidate knowledge of the expected data to this
    // Service implementation.
    self.update({
      url: endpoint
    });
  });
  self._router.on('data', function (message) {
    self._bus.emit(String(message[2]), JSON.parse(message[3]), function (err, result) {
      if (typeof result === 'undefined') {
        result = new Buffer(0);
      } else {
        result = JSON.stringify(result);
      }

      self._router.write([message[0], message[1], JSON.stringify(err || null), result]);
    });
  });
  self._router.on('error', function (err) {
    debug('Error in %s router:', self.name, err);
  });
  self._dealer.on('error', function (err) {
    debug('Error in %s dealer:', self.name, err);
  });

  return self;
};

/*!
 * Export `Service`.
 */
module.exports = Service;
