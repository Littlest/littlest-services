var fork = require('child_process').fork;
var test = require('tape');
var services = require('../');

function forkPeer() {
  var peer = fork(require.resolve('./fixtures/peer'));

  peer.request = function request(command, data) {
    peer.send({
      name: command,
      params: data
    });
  };

  return peer;
}

test('start-stop', function (t) {
  forkPeer()
    .on('exit', function () {
      t.end();
    })
    .disconnect();
});

test('get-set-get', function (t) {
  var peer = forkPeer()

  peer.on('exit', function () {
    t.end();
  });

  var registry = services.createRegistry();

  t.plan(3);

  registry.request('test:get', {
    key: 'foo'
  })
    .then(function (value) {
      t.equal(value, undefined);

      return registry.request('test:set', {
        key: 'foo',
        value: 'bar'
      });
    })
    .then(function (value) {
      t.equal(value, 'bar');

      return registry.request('test:get', {
        key: 'foo'
      });
    })
    .then(function (value) {
      t.equal(value, 'bar');

      peer.disconnect();
      registry.destroy();
    });
});

test('bad command', function (t) {
  var peer = forkPeer();

  peer.on('exit', function () {
    t.end();
  });

  var registry = services.createRegistry();

  t.plan(1);

  var timerId = setTimeout(function () {
    t.fail('Timeout');

    peer.disconnect();
    registry.destroy();
  }, 1000);

  registry.request('test:invalid', {})
    .then(function () {
      t.fail('Expected to throw.');
    }, function (err) {
      t.equal(err.message, 'Not Found: test:invalid');

      clearTimeout(timerId);

      peer.disconnect();
      registry.destroy();
    });
});
