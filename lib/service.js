/**
 * TODO: Description.
 */
var events = require('events');
var debug = require('debug')('services:Service');
var discovery = require('discovery');
var onemq = require('onemq');
var mi = require('mi');
var when = require('when');
var common = require('./common');

/**
 * Internal "constructor".
 */
function Service() {
  this._router = onemq.Router.create();

  this._handlers = {};

  this._initEvents();
}
mi.inherit(Service, discovery.Service);

/**
 * TODO: Description.
 */
Service.create = function create(registry, name) {
  var cls = this
    , service = discovery.Registry.prototype.createService.call(registry, name, { url: null });

  debug('Creating Service %s.', name);

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

  debug('Destroying Service %s.', this.name);

  return this;
};

/**
 * TODO: Description.
 */
Service.prototype.handle = function handle(name, fn) {
  var self = this;

  // TODO(schoon) - Multiple handlers?
  // TODO(schoon) - Unhandle?
  self._handlers[name] = fn;

  return self;
};

/**
 * TODO: Description.
 */
Service.prototype.request = function request(name, data) {
  return this._registry.request(name, data);
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
    var request = common.parseRequestMessage(message);
    var handler = self._handlers[request.command];

    if (!handler) {
      request.error = new Error(
        'Not Found: ' + self.name + ':' + request.command
      );
      self._router.write(common.buildResponseMessage(request));
      return;
    }

    when(handler(request.data))
      .then(function (result) {
        request.data = result;
      }, function (err) {
        request.error = err;
      })
      .then(function () {
        self._router.write(common.buildResponseMessage(request));
      });
  });
  self._router.on('error', function (err) {
    debug('Error in %s router:', self.name, err);
  });

  return self;
};

/*!
 * Export `Service`.
 */
module.exports = Service;
