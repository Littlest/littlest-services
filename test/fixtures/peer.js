var services = require('../../');
var registry = services.createRegistry();
var data = {};

registry
  .createService('test')
  .handle('get', function (params, callback) {
    var value = data[params.key];
    console.info('GET %s: %j', params.key, value);
    callback(null, value);
  })
  .handle('set', function (params, callback) {
    data[params.key] = params.value;
    console.info('SET %s: %j', params.key, params.value);
    callback();
  });

process.on('disconnect', function () {
  registry.destroy();
});

process.on('message', function (msg) {
  registry.request(msg.name, msg.params);
});
