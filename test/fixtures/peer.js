var services = require('../../');
var registry = services.createRegistry();
var data = {};

registry
  .createService('test')
  .handle('get', function (params) {
    var value = data[params.key];
    console.info('GET %s: %j', params.key, value);
    return value;
  })
  .handle('set', function (params) {
    data[params.key] = params.value;
    console.info('SET %s: %j', params.key, params.value);
    return params.value;
  });

process.on('disconnect', function () {
  registry.destroy();
});

process.on('message', function (msg) {
  registry.request(msg.name, msg.params);
});
