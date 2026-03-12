'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _removeValue = require('remove-value');

var _removeValue2 = _interopRequireDefault(_removeValue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Channel = function (_EventEmitter) {
  _inherits(Channel, _EventEmitter);

  function Channel(client, id) {
    _classCallCheck(this, Channel);

    var _this = _possibleConstructorReturn(this, (Channel.__proto__ || Object.getPrototypeOf(Channel)).call(this));

    _this._client = client;
    _this._id = id;
    _this._links = [];
    _this.users = [];
    _this.children = [];
    _this._haveRequestedDescription = false;
    return _this;
  }

  _createClass(Channel, [{
    key: '_remove',
    value: function _remove() {
      if (this.parent) {
        (0, _removeValue2.default)(this.parent.children, this);
      }
      this.emit('remove');
    }
  }, {
    key: '_update',
    value: function _update(msg) {
      var _this2 = this;

      var changes = {};
      if (msg.name != null) {
        changes.name = this._name = msg.name;
      }
      if (msg.description != null) {
        changes.description = this._description = msg.description;
      }
      if (msg.description_hash != null) {
        changes.descriptionHash = this._descriptionHash = msg.description_hash;
        this._haveRequestedDescription = false; // invalidate previous request
      }
      if (msg.temporary != null) {
        changes.temporary = this._temporary = msg.temporary;
      }
      if (msg.position != null) {
        changes.position = this._position = msg.position;
      }
      if (msg.max_users != null) {
        changes.maxUsers = this._maxUsers = msg.max_users;
      }
      if (msg.links) {
        this._links = msg.links;
        changes.links = this.links;
      }
      if (msg.links_remove) {
        this._links = this._links.filter(function (e) {
          return !msg.links_remove.includes(e);
        });
        changes.links = this.links;
      }
      if (msg.links_add) {
        msg.links_add.filter(function (e) {
          return !_this2._links.includes(e);
        }).forEach(function (e) {
          return _this2._links.push(e);
        });
        changes.links = this.links;
      }
      if (msg.parent != null) {
        if (this.parent) {
          (0, _removeValue2.default)(this.parent.children, this);
        }
        this._parentId = msg.parent;
        if (this.parent) {
          this.parent.children.push(this);
        }
        changes.parent = this.parent;
      }
      this.emit('update', changes);
    }
  }, {
    key: 'setName',
    value: function setName(name) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          name: name
        }
      });
    }
  }, {
    key: 'setParent',
    value: function setParent(parent) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          parent: parent._id
        }
      });
    }
  }, {
    key: 'setTemporary',
    value: function setTemporary(temporary) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          temporary: temporary
        }
      });
    }
  }, {
    key: 'setDescription',
    value: function setDescription(description) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          description: description
        }
      });
    }
  }, {
    key: 'setPosition',
    value: function setPosition(position) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          position: position
        }
      });
    }
  }, {
    key: 'setLinks',
    value: function setLinks(links) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          links: links.map(function (c) {
            return c._id;
          })
        }
      });
    }
  }, {
    key: 'setMaxUsers',
    value: function setMaxUsers(maxUsers) {
      this._client._send({
        name: 'ChannelState',
        payload: {
          channel_id: this._id,
          max_users: maxUsers
        }
      });
    }
  }, {
    key: 'sendMessage',
    value: function sendMessage(message) {
      this._client._send({
        name: 'TextMessage',
        payload: {
          channel_id: [this._id],
          message: message
        }
      });
    }
  }, {
    key: 'sendTreeMessage',
    value: function sendTreeMessage(message) {
      this._client._send({
        name: 'TextMessage',
        payload: {
          tree_id: [this._id],
          message: message
        }
      });
    }
  }, {
    key: 'requestDescription',
    value: function requestDescription() {
      if (this._haveRequestedDescription) return;
      this._client._send({
        name: 'RequestBlob',
        payload: {
          channel_description: this._id
        }
      });
      this._haveRequestedDescription = true;
    }
  }, {
    key: 'id',
    get: function get() {
      return this._id;
    }
  }, {
    key: 'name',
    get: function get() {
      return this._name;
    },
    set: function set(to) {
      throw new Error('Cannot set name. Use #setName(name) instead.');
    }
  }, {
    key: 'parent',
    get: function get() {
      return this._client._channelById[this._parentId];
    },
    set: function set(to) {
      throw new Error('Cannot set parent. Use #setParent(channel) instead.');
    }
  }, {
    key: 'description',
    get: function get() {
      return this._description;
    },
    set: function set(to) {
      throw new Error('Cannot set description. Use #setDescription(desc) instead.');
    }
  }, {
    key: 'descriptionHash',
    get: function get() {
      return this._descriptionHash;
    },
    set: function set(to) {
      throw new Error('Cannot set descriptionHash.');
    }
  }, {
    key: 'temporary',
    get: function get() {
      return this._temporary;
    },
    set: function set(to) {
      throw new Error('Cannot set temporary. Use #setTemporary(tmp) instead.');
    }
  }, {
    key: 'position',
    get: function get() {
      return this._position;
    },
    set: function set(to) {
      throw new Error('Cannot set position.');
    }
  }, {
    key: 'maxUsers',
    get: function get() {
      return this._maxUsers;
    },
    set: function set(to) {
      throw new Error('Cannot set maxUsers.');
    }
  }, {
    key: 'links',
    get: function get() {
      var _this3 = this;

      return this._links.map(function (id) {
        return _this3._client._channelById[id];
      });
    },
    set: function set(to) {
      throw new Error('Cannot set links. Use #setLinks(links) instead.');
    }
  }]);

  return Channel;
}(_events.EventEmitter);

exports.default = Channel;