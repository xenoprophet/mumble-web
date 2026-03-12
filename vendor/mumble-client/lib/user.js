'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _dropStream = require('drop-stream');

var _dropStream2 = _interopRequireDefault(_dropStream);

var _removeValue = require('remove-value');

var _removeValue2 = _interopRequireDefault(_removeValue);

var _rtimer = require('rtimer');

var _rtimer2 = _interopRequireDefault(_rtimer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var User = function (_EventEmitter) {
  _inherits(User, _EventEmitter);

  function User(client, id, ssrc) {
    _classCallCheck(this, User);

    var _this = _possibleConstructorReturn(this, (User.__proto__ || Object.getPrototypeOf(User)).call(this));

    _this._client = client;
    _this._id = id;
    _this._ssrc = ssrc;
    _this._haveRequestedTexture = false;
    _this._haveRequestedComment = false;
    return _this;
  }

  _createClass(User, [{
    key: '_update',
    value: function _update(msg) {
      var changes = {};
      if (msg.name != null) {
        changes.username = this._username = msg.name;
      }
      if (msg.user_id != null) {
        changes.uniqueId = this._uniqueId = msg.user_id;
      }
      if (msg.mute != null) {
        changes.mute = this._mute = msg.mute;
      }
      if (msg.deaf != null) {
        changes.deaf = this._deaf = msg.deaf;
      }
      if (msg.suppress != null) {
        changes.suppress = this._suppress = msg.suppress;
      }
      if (msg.self_mute != null) {
        changes.selfMute = this._selfMute = msg.self_mute;
      }
      if (msg.self_deaf != null) {
        changes.selfDeaf = this._selfDeaf = msg.self_deaf;
      }
      if (msg.texture != null) {
        changes.texture = this._texture = msg.texture;
      }
      if (msg.texture_hash != null) {
        changes.textureHash = this._textureHash = msg.texture_hash;
        this._haveRequestedTexture = false; // invalidate previous request
      }
      if (msg.comment != null) {
        changes.comment = this._comment = msg.comment;
      }
      if (msg.comment_hash != null) {
        changes.commentHash = this._commentHash = msg.comment_hash;
        this._haveRequestedComment = false; // invalidate previous request
      }
      if (msg.priority_speaker != null) {
        changes.prioritySpeaker = this._prioritySpeaker = msg.priority_speaker;
      }
      if (msg.recording != null) {
        changes.recording = this._recording = msg.recording;
      }
      if (msg.hash != null) {
        changes.certHash = this._certHash = msg.hash;
      }
      if (msg.channel_id != null) {
        if (this.channel) {
          (0, _removeValue2.default)(this.channel.users, this);
        }
        this._channelId = msg.channel_id;
        if (this.channel) {
          this.channel.users.push(this);
        }
        changes.channel = this.channel;
      }
      this.emit('update', this._client._userById[msg.actor], changes);
    }
  }, {
    key: '_remove',
    value: function _remove(actor, reason, ban) {
      if (this.channel) {
        (0, _removeValue2.default)(this.channel.users, this);
      }
      this.emit('remove', actor, reason, ban);
    }
  }, {
    key: '_getOrCreateVoiceStream',
    value: function _getOrCreateVoiceStream(target) {
      var _this2 = this;

      if (!this._voice) {
        // New transmission
        if (!this._client._codecs) {
          // No codecs available, cannot decode
          this._voice = _dropStream2.default.obj();
        } else {
          this._voice = this._client._codecs.createDecoderStream(this);
        }
        this._voice.target = target;
        this._voice.once('close', function () {
          _this2._voice = null;
        });
        if (!this._client._webrtcEnabled) {
          this._voiceTimeout = new _rtimer2.default(function () {
            _this2._voice.end();
            _this2._voice = null;
          }, this._client._options.userVoiceTimeout || 200).set();
        }
        this.emit('voice', this._voice);
      }
      return this._voice;
    }
  }, {
    key: '_getDuration',
    value: function _getDuration(codec, frames) {
      var _this3 = this;

      if (this._client._codecs) {
        var duration = 0;
        frames.forEach(function (frame) {
          duration += _this3._client._codecs.getDuration(codec, frame);
        });
        return duration;
      } else {
        return frames.length * 10;
      }
    }

    /**
     * This method filters and inserts empty frames as needed to accout
     * for packet loss and then writes to the {@link #_voice} stream.
     * If this is a new transmission it emits the 'voice' event and if
     * the transmission has ended it closes the stream.
     */

  }, {
    key: '_onVoice',
    value: function _onVoice(seqNum, codec, target, frames, position, end) {
      var _this4 = this;

      if (frames.length > 0) {
        var duration = this._getDuration(codec, frames);
        if (this._voice != null) {
          // This is not the first packet in this transmission

          // So drop it if it's late
          if (this._lastVoiceSeqId > seqNum) {
            return;
          }

          // And make up for lost packets
          if (this._lastVoiceSeqId < seqNum - duration / 10) {
            var lost = seqNum - this._lastVoiceSeqId - 1;
            // Cap at 10 lost frames, the audio will sound broken at that point anyway
            if (lost > 10) {
              lost = 10;
            }
            for (var i = 0; i < lost; i++) {
              this._getOrCreateVoiceStream(target).write({
                target: target,
                codec: codec,
                frame: null,
                position: position
              });
            }
          }
        }
        frames.forEach(function (frame) {
          _this4._getOrCreateVoiceStream(target).write({
            target: target,
            codec: codec,
            frame: frame,
            position: position
          });
        });
        this._voiceTimeout.set();
        this._lastVoiceSeqId = seqNum + duration / 10 - 1;
      }
      if (end && this._voice) {
        this._voiceTimeout.clear();
        this._voiceTimeout = null;
        this._voice.end();
        this._voice = null;
      }
    }
  }, {
    key: 'setMute',
    value: function setMute(mute) {
      var message = {
        name: 'UserState',
        payload: {
          session: this._id,
          mute: mute
        }
      };
      if (!mute) message.payload.deaf = false;
      this._client._send(message);
    }
  }, {
    key: 'setDeaf',
    value: function setDeaf(deaf) {
      var message = {
        name: 'UserState',
        payload: {
          session: this._id,
          deaf: deaf
        }
      };
      if (deaf) message.payload.mute = true;
      this._client._send(message);
    }
  }, {
    key: 'clearComment',
    value: function clearComment() {
      this._client._send({
        name: 'UserState',
        payload: {
          session: this._id,
          comment: ''
        }
      });
    }
  }, {
    key: 'clearTexture',
    value: function clearTexture() {
      this._client._send({
        name: 'UserState',
        payload: {
          session: this._id,
          texture: ''
        }
      });
    }
  }, {
    key: 'requestComment',
    value: function requestComment() {
      if (this._haveRequestedComment) return;
      this._client._send({
        name: 'RequestBlob',
        payload: {
          session_comment: this._id
        }
      });
      this._haveRequestedComment = true;
    }
  }, {
    key: 'requestTexture',
    value: function requestTexture() {
      if (this._haveRequestedTexture) return;
      this._client._send({
        name: 'RequestBlob',
        payload: {
          session_texture: this._id
        }
      });
      this._haveRequestedTexture = true;
    }
  }, {
    key: 'register',
    value: function register() {
      this._client._send({
        name: 'UserState',
        payload: {
          session: this._id,
          user_id: 0
        }
      });
    }
  }, {
    key: 'sendMessage',
    value: function sendMessage(message) {
      this._client._send({
        name: 'TextMessage',
        payload: {
          session: this._id,
          message: message
        }
      });
    }
  }, {
    key: 'setChannel',
    value: function setChannel(channel) {
      this._client._send({
        name: 'UserState',
        payload: {
          session: this._id,
          channel_id: channel._id
        }
      });
    }
  }, {
    key: 'id',
    get: function get() {
      return this._id;
    }
  }, {
    key: 'ssrc',
    get: function get() {
      return this._ssrc;
    }
  }, {
    key: 'username',
    get: function get() {
      return this._username;
    },
    set: function set(to) {
      throw new Error('Cannot set username.');
    }
  }, {
    key: 'uniqueId',
    get: function get() {
      return this._uniqueId;
    },
    set: function set(to) {
      throw new Error('Cannot set uniqueId. Maybe try #register()?');
    }
  }, {
    key: 'mute',
    get: function get() {
      return this._mute;
    },
    set: function set(to) {
      throw new Error('Cannot set mute. Use #setMute(mute) instead.');
    }
  }, {
    key: 'deaf',
    get: function get() {
      return this._deaf;
    },
    set: function set(to) {
      throw new Error('Cannot set deaf. Use #setDeaf(deaf) instead.');
    }
  }, {
    key: 'selfMute',
    get: function get() {
      return this._selfMute;
    },
    set: function set(to) {
      throw new Error('Cannot set selfMute. Use Client#setSelfMute(mute) instead.');
    }
  }, {
    key: 'selfDeaf',
    get: function get() {
      return this._selfDeaf;
    },
    set: function set(to) {
      throw new Error('Cannot set selfDeaf. Use Client#setSelfDeaf(deaf) instead.');
    }
  }, {
    key: 'suppress',
    get: function get() {
      return this._suppress;
    },
    set: function set(to) {
      throw new Error('Cannot set suppress.');
    }
  }, {
    key: 'texture',
    get: function get() {
      return this._texture;
    },
    set: function set(to) {
      throw new Error('Cannot set texture. Use Client#setSelfTexture(texture) or #clearTexture() instead.');
    }
  }, {
    key: 'textureHash',
    get: function get() {
      return this._textureHash;
    },
    set: function set(to) {
      throw new Error('Cannot set textureHash.');
    }
  }, {
    key: 'comment',
    get: function get() {
      return this._comment;
    },
    set: function set(to) {
      throw new Error('Cannot set comment. Use Client#setSelfTexture(texture) or #clearComment() instead.');
    }
  }, {
    key: 'commentHash',
    get: function get() {
      return this._commentHash;
    },
    set: function set(to) {
      throw new Error('Cannot set commentHash.');
    }
  }, {
    key: 'prioritySpeaker',
    get: function get() {
      return this._prioritySpeaker;
    },
    set: function set(to) {
      throw new Error('Cannot set prioritySpeaker. Use #setPrioritySpeaker(prioSpeaker) instead.');
    }
  }, {
    key: 'recording',
    get: function get() {
      return this._recording;
    },
    set: function set(to) {
      throw new Error('Cannot set recording. Use Client#setSelfRecording(recording) instead.');
    }
  }, {
    key: 'certHash',
    get: function get() {
      return this._certHash;
    },
    set: function set(to) {
      throw new Error('Cannot set certHash.');
    }
  }, {
    key: 'channel',
    get: function get() {
      if (this._channelId != null) {
        return this._client._channelById[this._channelId];
      } else {
        return null;
      }
    },
    set: function set(to) {
      throw new Error('Cannot set channel. Use #setChannel(channel) instead.');
    }
  }]);

  return User;
}(_events.EventEmitter);

exports.default = User;