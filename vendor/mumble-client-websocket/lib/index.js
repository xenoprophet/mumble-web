'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _promise = require('promise');

var _promise2 = _interopRequireDefault(_promise);

var _websocketStream = require('websocket-stream');

var _websocketStream2 = _interopRequireDefault(_websocketStream);

var _mumbleClient = require('mumble-client');

var _mumbleClient2 = _interopRequireDefault(_mumbleClient);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function connect(address, options, callback) {
  return new _promise2.default(function (resolve, reject) {
    var ws = (0, _websocketStream2.default)(address, ['binary']).on('error', reject).on('connect', function () {
      return resolve(ws);
    });
  }).then(function (ws) {
    return new _mumbleClient2.default(options).connectDataStream(ws);
  }).nodeify(callback);
}

exports.default = connect;