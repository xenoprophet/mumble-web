'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _mumbleStreams = require('mumble-streams');

var _mumbleStreams2 = _interopRequireDefault(_mumbleStreams);

var _reduplexer = require('reduplexer');

var _reduplexer2 = _interopRequireDefault(_reduplexer);

var _events = require('events');

var _through = require('through2');

var _through2 = _interopRequireDefault(_through);

var _promise = require('promise');

var _promise2 = _interopRequireDefault(_promise);

var _dropStream = require('drop-stream');

var _dropStream2 = _interopRequireDefault(_dropStream);

var _utils = require('./utils.js');

var _user2 = require('./user');

var _user3 = _interopRequireDefault(_user2);

var _channel = require('./channel');

var _channel2 = _interopRequireDefault(_channel);

var _removeValue = require('remove-value');

var _removeValue2 = _interopRequireDefault(_removeValue);

var _statsIncremental = require('stats-incremental');

var _statsIncremental2 = _interopRequireDefault(_statsIncremental);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DenyType = _mumbleStreams2.default.data.messages.PermissionDenied.DenyType;

/*
 * @typedef {'Opus'} Codec
 */

/**
 * Number of the voice target when outgoing (0 for normal talking, 1-31 for
 * a voice target).
 * String describing the source when incoming.
 * @typedef {number|'normal'|'shout'|'whisper'} VoiceTarget
 */

/**
 * @typedef {object} VoiceData
 * @property {VoiceTarget} target - Target of the audio
 * @property {Codec} codec - The codec of the audio packet
 * @property {Buffer} frame - Encoded audio frame, null indicates a lost frame
 * @property {?Position} position - Position of audio source
 */

/**
 * Interleaved 32-bit float PCM frames in [-1; 1] range with sample rate of 48k.
 * @typedef {object} PCMData
 * @property {VoiceTarget} target - Target of the audio
 * @property {Float32Array} pcm - The pcm data
 * @property {number} numberOfChannels - Number of channels
 * @property {?Position} position - Position of audio source
 * @property {?number} bitrate - Target bitrate hint for encoder, see for default {@link MumbleClient#setAudioQuality}
 */

/**
 * Transforms {@link VoiceData} to {@link PCMData}.
 * Should ignore any unknown codecs.
 *
 * @interface DecoderStream
 * @extends stream.Transform
 */

/**
 * Transforms {@link PCMData} to {@link VoiceData}.
 *
 * @interface EncoderStream
 * @extends stream.Transform
 */

/**
 * @interface Codecs
 * @property {number[]} celt - List of celt versions supported by this implementation
 * @property {boolean} opus - Whether this implementation supports the Opus codec
 */

/**
 * Returns the duration of encoded voice data without actually decoding it.
 *
 * @function Codecs#getDuration
 * @param {Codec} codec - The codec
 * @param {Buffer} buffer - The encoded data
 * @return {number} The duration in milliseconds (has to be a multiple of 10)
 */

/**
 * Creates a new decoder stream for a transmission of the specified user.
 * This method is called for every single transmission (whenever a user starts
 * speaking), as such it must not be expensive.
 *
 * @function Codecs#createDecoderStream
 * @param {User} user - The user
 * @return {DecoderStream} The decoder stream
 */

/**
 * Creates a new encoder stream for a outgoing transmission.
 * This method is called for every single transmission (whenever the user
 * starts speaking), as such it must not be expensive.
 *
 * @function Codecs#createEncoderStream
 * @param {Codec} codec - The codec
 * @return {EncoderStream} The endecoder stream
 */

/**
 * Single use Mumble client.
 */

var MumbleClient = function (_EventEmitter) {
  _inherits(MumbleClient, _EventEmitter);

  /**
   * A mumble client.
   * This object may only be connected to one server and cannot be reused.
   *
   * @param {object} options - Options
   * @param {string} options.username - User name of the client
   * @param {string} [options.password] - Server password to use
   * @param {string[]} [options.tokens] - Array of access tokens to use
   * @param {string} [options.clientSoftware] - Client software name/version
   * @param {string} [options.osName] - Client operating system name
   * @param {string} [options.osVersion] - Client operating system version
   * @param {Codecs} [options.codecs] - Codecs used for voice
   * @param {number} [options.userVoiceTimeout] - Milliseconds after which an
   *  inactive voice transmissions is timed out
   * @param {number} [options.maxInFlightDataPings] - Amount of data pings without response
   *  after which the connection is considered timed out
   * @param {number} [options.dataPingInterval] - Interval of data pings (in ms)
   * @param {object} [options.webrtc] - WebRTC options if the server supports it
   * @param {object} [options.webrtc.enabled] - Whether to enable WebRTC support
   * @param {object} [options.webrtc.required] - Failed connection if WebRTC unsupported by server
   * @param {object} [options.webrtc.mic] - MediaStream (or track) to use as local source of audio
   * @param {object} [options.webrtc.audioContext] - AudioContext to which remote nodes are connected
   */
  function MumbleClient(options) {
    _classCallCheck(this, MumbleClient);

    var _this = _possibleConstructorReturn(this, (MumbleClient.__proto__ || Object.getPrototypeOf(MumbleClient)).call(this));

    if (!options.username) {
      throw new Error('No username given');
    }

    _this._options = options || {};
    _this._username = options.username;
    _this._password = options.password;
    _this._tokens = options.tokens;
    _this._codecs = options.codecs;

    _this._webrtcOptions = options.webrtc || {};
    _this._webrtcSupported = _this._webrtcOptions.enabled;
    _this._webrtcRequired = _this._webrtcOptions.required;
    _this._webrtcMic = _this._webrtcOptions.mic;
    _this._webrtcAudioCtx = _this._webrtcOptions.audioContext;
    if (_this._webrtcSupported) {
      if (!_this._webrtcMic || !_this._webrtcAudioCtx) {
        throw Error('Need mic and audio context for WebRTC');
      }
      _this._webrtcSessionId = Date.now();
      _this._webrtcSessionVersion = 0;
      _this._pc = new window.RTCPeerConnection({
        sdpSemantics: 'unified-plan'
      });
      _this._pc.addStream(_this._webrtcMic);
      _this._pc.onicecandidate = function (event) {
        if (event.candidate && event.candidate.candidate) {
          _this._send({
            name: 'IceCandidate',
            payload: {
              content: event.candidate.candidate
            }
          });
        }
      };
      _this._pc.ontrack = function (event) {
        // This is how it should ideally work:
        // this._webrtcAudioCtx.createMediaStreamSource(event.streams[0])
        //   .connect(this._webrtcAudioCtx.destination)
        // but Chrome apparently only supports webrtc+webaudio for input, not for output...
        // So instead we need to create <audio> elements for each stream:
        var elem = document.createElement('audio');
        elem.srcObject = event.streams[0];
        elem.play();
      };
    }

    _this._dataPingInterval = options.dataPingInterval || 5000;
    _this._maxInFlightDataPings = options.maxInFlightDataPings || 2;
    _this._dataStats = new _statsIncremental2.default();
    _this._voiceStats = new _statsIncremental2.default();

    _this._userById = {};
    _this._channelById = {};

    _this.users = [];
    _this.channels = [];

    _this._dataEncoder = new _mumbleStreams2.default.data.Encoder();
    _this._dataDecoder = new _mumbleStreams2.default.data.Decoder();
    _this._voiceEncoder = new _mumbleStreams2.default.voice.Encoder('server');
    _this._voiceDecoder = new _mumbleStreams2.default.voice.Decoder('server');
    _this._data = (0, _reduplexer2.default)(_this._dataEncoder, _this._dataDecoder, { objectMode: true });
    _this._voice = (0, _reduplexer2.default)(_this._voiceEncoder, _this._voiceDecoder, { objectMode: true });

    _this._data.on('data', _this._onData.bind(_this));
    _this._voice.on('data', _this._onVoice.bind(_this));
    _this._voiceEncoder.on('data', function (data) {
      // TODO This should only be the fallback option
      _this._data.write({
        name: 'UDPTunnel',
        payload: data
      });
    });
    _this._voiceDecoder.on('unknown_codec', function (codecId) {
      return _this.emit('unknown_codec', codecId);
    });
    _this._data.on('end', _this.disconnect.bind(_this));

    _this._registerErrorHandler(_this._data, _this._voice, _this._dataEncoder, _this._dataDecoder, _this._voiceEncoder, _this._voiceDecoder);

    _this._disconnected = false;
    return _this;
  }

  _createClass(MumbleClient, [{
    key: '_registerErrorHandler',
    value: function _registerErrorHandler() {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = arguments[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var obj = _step.value;

          obj.on('error', this._error.bind(this));
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    }
  }, {
    key: '_error',
    value: function _error(reason) {
      this.emit('error', reason);
      this.disconnect();
    }
  }, {
    key: '_send',
    value: function _send(msg) {
      this._data.write(msg);
    }

    /**
     * Connects this client to a duplex stream that is used for the data channel.
     * The provided duplex stream is expected to be valid and usable.
     * Calling this method will begin the initialization of the connection.
     *
     * @param stream - The stream used for the data channel.
     * @param callback - Optional callback that is invoked when the connection has been established.
     */

  }, {
    key: 'connectDataStream',
    value: function connectDataStream(stream, callback) {
      var _this2 = this;

      if (this._dataStream) throw Error('Already connected!');
      this._dataStream = stream;

      // Connect the supplied stream to the data channel encoder and decoder
      this._registerErrorHandler(stream);
      this._dataEncoder.pipe(stream).pipe(this._dataDecoder);

      // Send the initial two packets
      this._send({
        name: 'Version',
        payload: {
          version: _mumbleStreams2.default.version.toUInt8(),
          release: this._options.clientSoftware || 'Node.js mumble-client',
          os: this._options.osName || (0, _utils.getOSName)(),
          os_version: this._options.osVersion || (0, _utils.getOSVersion)()
        }
      });
      this._send({
        name: 'Authenticate',
        payload: {
          username: this._username,
          password: this._password,
          tokens: this._tokens,
          celt_versions: (this._codecs || { celt: [] }).celt,
          opus: (this._codecs || { opus: false }).opus,
          webrtc: this._webrtcSupported
        }
      });

      return new _promise2.default(function (resolve, reject) {
        _this2.once('connected', function () {
          return resolve(_this2);
        });
        _this2.once('reject', reject);
        _this2.once('error', reject);
      }).nodeify(callback);
    }

    /**
     * Connects this client to a duplex stream that is used for the voice channel.
     * The provided duplex stream is expected to be valid and usable.
     * The stream may be unreliable. That is, it may lose packets or deliver them
     * out of order.
     * It must however gurantee that packets arrive unmodified and/or are dropped
     * when corrupted.
     * It is also responsible for any encryption that is necessary.
     *
     * Connecting a voice channel is entirely optional. If no voice channel
     * is connected, all voice data is tunneled through the data channel.
     *
     * @param stream - The stream used for the data channel.
     * @returns {undefined}
     */

  }, {
    key: 'connectVoiceStream',
    value: function connectVoiceStream(stream) {
      // Connect the stream to the voice channel encoder and decoder
      this._registerErrorHandler(stream);
      this._voiceEncoder.pipe(stream).pipe(this._voiceDecoder);

      // TODO: Ping packet
    }
  }, {
    key: 'createVoiceStream',
    value: function createVoiceStream() {
      var _this3 = this;

      var target = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
      var numberOfChannels = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;

      if (this._webrtcEnabled) {
        this._webrtcMic.getAudioTracks()[0].enabled = true;
        this._send({
          name: 'TalkingState',
          payload: {
            target: target
          }
        });
        return _dropStream2.default.obj().on('finish', function () {
          _this3._webrtcMic.getAudioTracks()[0].enabled = false;
          _this3._send({
            name: 'TalkingState',
            payload: {}
          });
        });
      }
      if (!this._codecs) {
        return _dropStream2.default.obj();
      }
      var voiceStream = _through2.default.obj(function (chunk, encoding, callback) {
        if (chunk instanceof Buffer) {
          chunk = new Float32Array(chunk.buffer, chunk.byteOffset, chunk.byteLength / 4);
        }
        if (chunk instanceof Float32Array) {
          chunk = {
            target: target,
            pcm: chunk,
            numberOfChannels: numberOfChannels
          };
        } else {
          chunk = {
            target: target,
            pcm: chunk.pcm,
            numberOfChannels: numberOfChannels,
            position: { x: chunk.x, y: chunk.y, z: chunk.z }
          };
        }
        var samples = _this3._samplesPerPacket || chunk.pcm.length / numberOfChannels;
        chunk.bitrate = _this3.getActualBitrate(samples, chunk.position != null);
        callback(null, chunk);
      });
      var codec = 'Opus'; // TODO
      var seqNum = 0;
      voiceStream.pipe(this._codecs.createEncoderStream(codec)).on('data', function (data) {
        var duration = _this3._codecs.getDuration(codec, data.frame) / 10;
        _this3._voice.write({
          seqNum: seqNum,
          codec: codec,
          mode: target,
          frames: [data.frame],
          position: data.position,
          end: false
        });
        seqNum += duration;
      }).on('end', function () {
        _this3._voice.write({
          seqNum: seqNum,
          codec: codec,
          mode: target,
          frames: [],
          end: true
        });
      });
      return voiceStream;
    }

    /**
     * Method called when new voice packets arrive.
     * Forwards the packet to the source user.
     */

  }, {
    key: '_onVoice',
    value: function _onVoice(chunk) {
      var user = this._userById[chunk.source];
      user._onVoice(chunk.seqNum, chunk.codec, chunk.target, chunk.frames, chunk.position, chunk.end);
    }

    /**
     * Method called when new data packets arrive.
     * If there is a method named '_onPacketName', the data is forwarded to
     * that method, otherwise it is logged as unhandled.
     *
     * @param {object} chunk - The data packet
     */

  }, {
    key: '_onData',
    value: function _onData(chunk) {
      if (this['_on' + chunk.name]) {
        this['_on' + chunk.name](chunk.payload);
      } else {
        console.log('Unhandled data packet:', chunk);
      }
    }
  }, {
    key: '_onUDPTunnel',
    value: function _onUDPTunnel(payload) {
      // Forward tunneled udp packets to the voice pipeline
      this._voiceDecoder.write(payload);
    }
  }, {
    key: '_onVersion',
    value: function _onVersion(payload) {
      this.serverVersion = {
        major: payload.version >> 16,
        minor: payload.version >> 8 & 0xff,
        patch: payload.version >> 0 & 0xff,
        release: payload.release,
        os: payload.os,
        osVersion: payload.os_version
      };
    }
  }, {
    key: '_onServerSync',
    value: function _onServerSync(payload) {
      var _this4 = this;

      // This packet finishes the initialization phase
      if (this._webrtcRequired && !this._webrtcEnabled) {
        this._error('server_does_not_support_webrtc');
        return;
      }

      this.self = this._userById[payload.session];
      this.maxBandwidth = payload.max_bandwidth;
      this.welcomeMessage = payload.welcome_text;

      // Make sure we send regular ping packets to not get disconnected
      this._pinger = setInterval(function () {
        if (_this4._inFlightDataPings >= _this4._maxInFlightDataPings) {
          _this4._error('timeout');
          return;
        }
        var dataStats = _this4._dataStats.getAll();
        var voiceStats = _this4._voiceStats.getAll();
        var timestamp = new Date().getTime();
        var payload = {
          timestamp: timestamp
        };
        if (dataStats) {
          payload.tcp_packets = dataStats.n;
          payload.tcp_ping_avg = dataStats.mean;
          payload.tcp_ping_var = dataStats.variance;
        }
        if (voiceStats) {
          payload.udp_packets = voiceStats.n;
          payload.udp_ping_avg = voiceStats.mean;
          payload.udp_ping_var = voiceStats.variance;
        }
        _this4._send({
          name: 'Ping',
          payload: payload
        });
        _this4._inFlightDataPings++;
      }, this._dataPingInterval);

      // We are now connected
      this.emit('connected');
    }
  }, {
    key: '_onPing',
    value: function _onPing(payload) {
      if (this._inFlightDataPings <= 0) {
        console.warn('Got unexpected ping message:', payload);
        return;
      }
      this._inFlightDataPings--;

      var now = new Date().getTime();
      var duration = now - payload.timestamp.toNumber();
      this._dataStats.update(duration);
      this.emit('dataPing', duration);
    }
  }, {
    key: '_onReject',
    value: function _onReject(payload) {
      // We got rejected from the server for some reason.
      this.emit('reject', payload);
      this.disconnect();
    }
  }, {
    key: '_onPermissionDenied',
    value: function _onPermissionDenied(payload) {
      if (payload.type === DenyType.Text) {
        this.emit('denied', 'Text', null, null, payload.reason);
      } else if (payload.type === DenyType.Permission) {
        var user = this._userById[payload.session];
        var channel = this._channelById[payload.channel_id];
        this.emit('denied', 'Permission', user, channel, payload.permission);
      } else if (payload.type === DenyType.SuperUser) {
        this.emit('denied', 'SuperUser', null, null, null);
      } else if (payload.type === DenyType.ChannelName) {
        this.emit('denied', 'ChannelName', null, null, payload.name);
      } else if (payload.type === DenyType.TextTooLong) {
        this.emit('denied', 'TextTooLong', null, null, null);
      } else if (payload.type === DenyType.TemporaryChannel) {
        this.emit('denied', 'TemporaryChannel', null, null, null);
      } else if (payload.type === DenyType.MissingCertificate) {
        var _user = this._userById[payload.session];
        this.emit('denied', 'MissingCertificate', _user, null, null);
      } else if (payload.type === DenyType.UserName) {
        this.emit('denied', 'UserName', null, null, payload.name);
      } else if (payload.type === DenyType.ChannelFull) {
        this.emit('denied', 'ChannelFull', null, null, null);
      } else if (payload.type === DenyType.NestingLimit) {
        this.emit('denied', 'NestingLimit', null, null, null);
      } else {
        throw Error('Invalid DenyType: ' + payload.type);
      }
    }
  }, {
    key: '_onTextMessage',
    value: function _onTextMessage(payload) {
      var _this5 = this;

      this.emit('message', this._userById[payload.actor], payload.message, payload.session.map(function (id) {
        return _this5._userById[id];
      }), payload.channel_id.map(function (id) {
        return _this5._channelById[id];
      }), payload.tree_id.map(function (id) {
        return _this5._channelById[id];
      }));
    }
  }, {
    key: '_onChannelState',
    value: function _onChannelState(payload) {
      var _this6 = this;

      var channel = this._channelById[payload.channel_id];
      if (!channel) {
        channel = new _channel2.default(this, payload.channel_id);
        this._channelById[channel._id] = channel;
        this.channels.push(channel);
        this.emit('newChannel', channel);
      }
      (payload.links_remove || []).forEach(function (otherId) {
        var otherChannel = _this6._channelById[otherId];
        if (otherChannel && otherChannel.links.indexOf(channel) !== -1) {
          otherChannel._update({
            links_remove: [payload.channel_id]
          });
        }
      });
      channel._update(payload);
    }
  }, {
    key: '_onChannelRemove',
    value: function _onChannelRemove(payload) {
      var channel = this._channelById[payload.channel_id];
      if (channel) {
        channel._remove();
        delete this._channelById[channel._id];
        (0, _removeValue2.default)(this.channels, channel);
      }
    }
  }, {
    key: '_onUserState',
    value: function _onUserState(payload) {
      var user = this._userById[payload.session];
      if (!user) {
        user = new _user3.default(this, payload.session, payload.ssrc);
        this._userById[user._id] = user;
        this.users.push(user);
        this.emit('newUser', user);

        this._updateWebRtc();

        // For some reason, the mumble protocol does not send the initial
        // channel of a client if it is the root channel
        payload.channel_id = payload.channel_id || 0;
      }
      user._update(payload);
    }
  }, {
    key: '_onUserRemove',
    value: function _onUserRemove(payload) {
      var user = this._userById[payload.session];
      if (user) {
        user._remove(this._userById[payload.actor], payload.reason, payload.ban);
        delete this._userById[user._id];
        (0, _removeValue2.default)(this.users, user);
      }
    }
  }, {
    key: '_createWebRtcOffer',
    value: function _createWebRtcOffer() {
      // TODO configure max bandwidth

      var sdp = [];
      // https://tools.ietf.org/html/rfc2327#section-6
      sdp.push('v=0');
      sdp.push('o=- ' + this._webrtcSessionId + ' ' + this._webrtcSessionVersion++ + ' IN IP4 0.0.0.0');
      sdp.push('s=-');
      sdp.push('t=0 0');

      sdp.push('a=fingerprint:sha-256 ' + this._remoteDtlsFingerprint);
      // https://tools.ietf.org/html/rfc4145#section-4
      // Would love to use 'passive' but WebRTC demands 'actpass' for the offerer
      sdp.push('a=setup:actpass');
      sdp.push('a=ice-pwd:' + this._remoteIcePwd);
      sdp.push('a=ice-ufrag:' + this._remoteIceUfrag);
      sdp.push('a=ice-options:trickle');
      sdp.push('a=group:BUNDLE 0' + this.users.map(function (user) {
        return ' ' + user.ssrc;
      }).join(''));
      sdp.push('a=msid-semantic:WMS *');

      sdp.push('m=audio 0 UDP/TLS/RTP/SAVPF 97');
      sdp.push('c=IN IP4 0.0.0.0');
      sdp.push('a=msid:0 0');
      sdp.push('a=mid:0');
      sdp.push('a=rtpmap:97 OPUS/48000/2');
      sdp.push('a=fmtp:97 stereo=0; useinbandfec=0; minptime=10');
      sdp.push('a=recvonly');
      sdp.push('a=rtcp-mux');
      sdp.push('a=bundle-only');

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = this.users[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var user = _step2.value;

          var ssrc = user.ssrc;
          sdp.push('m=audio 0 UDP/TLS/RTP/SAVPF 97');
          sdp.push('c=IN IP4 0.0.0.0');
          sdp.push('a=msid:' + ssrc + ' ' + ssrc);
          sdp.push('a=mid:' + ssrc);
          sdp.push('a=rtpmap:97 OPUS/48000/2');
          sdp.push('a=fmtp:97 stereo=0; useinbandfec=0; minptime=10');
          sdp.push('a=sendonly');
          sdp.push('a=rtcp-mux');
          sdp.push('a=ssrc:' + ssrc + ' cname:audio' + ssrc);
          sdp.push('a=bundle-only');
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      sdp.push('');

      return sdp.join('\n');
    }
  }, {
    key: '_parseWebRtcAnswer',
    value: function _parseWebRtcAnswer(answer) {
      var lines = answer.split(answer.indexOf('\r') === -1 ? '\n' : '\r\n');
      var icePwd = void 0,
          iceUfrag = void 0,
          dtlsFingerprint = void 0;
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = lines[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var line = _step3.value;

          if (line.startsWith('a=ice-pwd:')) {
            icePwd = line.substring('a=ice-pwd:'.length);
          }
          if (line.startsWith('a=ice-ufrag:')) {
            iceUfrag = line.substring('a=ice-ufrag:'.length);
          }
          if (line.startsWith('a=fingerprint:sha-256 ')) {
            dtlsFingerprint = line.substring('a=fingerprint:sha-256 '.length);
          }
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      return [icePwd, iceUfrag, dtlsFingerprint];
    }
  }, {
    key: '_updateWebRtc',
    value: function _updateWebRtc() {
      var _this7 = this;

      if (!this._remoteIcePwd) {
        return;
      }

      this._updateWebRtcPromise = (this._updateWebRtcPromise || _promise2.default.resolve()).then(function () {
        return _this7._pc.setRemoteDescription(new window.RTCSessionDescription({
          type: 'offer',
          sdp: _this7._createWebRtcOffer()
        }));
      }).then(function () {
        return _this7._pc.createAnswer();
      }).then(function (answer) {
        if (!_this7._hasSentWebRtcInit) {
          var _parseWebRtcAnswer2 = _this7._parseWebRtcAnswer(answer.sdp),
              _parseWebRtcAnswer3 = _slicedToArray(_parseWebRtcAnswer2, 3),
              icePwd = _parseWebRtcAnswer3[0],
              iceUfrag = _parseWebRtcAnswer3[1],
              dtlsFingerprint = _parseWebRtcAnswer3[2];

          _this7._send({
            name: 'WebRTC',
            payload: {
              ice_pwd: icePwd,
              ice_ufrag: iceUfrag,
              dtls_fingerprint: dtlsFingerprint
            }
          });
          _this7._hasSentWebRtcInit = true;
        }
        // server is always passive -> we always need to be active
        answer.sdp = answer.sdp.replace(/a=setup:passive/g, 'a=setup:active');
        return _this7._pc.setLocalDescription(answer);
      }).catch(function (err) {
        return console.error(err);
      });
    }
  }, {
    key: '_onWebRTC',
    value: function _onWebRTC(payload) {
      if (!this._pc) {
        return;
      }
      this._webrtcEnabled = true;

      this._remoteIcePwd = payload.ice_pwd;
      this._remoteIceUfrag = payload.ice_ufrag;
      this._remoteDtlsFingerprint = payload.dtls_fingerprint;

      this._updateWebRtc();
    }
  }, {
    key: '_onIceCandidate',
    value: function _onIceCandidate(payload) {
      if (this._pc) {
        this._pc.addIceCandidate(new window.RTCIceCandidate({
          sdpMLineIndex: 0,
          candidate: payload.content
        }), function () {}, console.error);
      }
    }
  }, {
    key: '_onTalkingState',
    value: function _onTalkingState(payload) {
      var user = this._userById[payload.session];
      if (user) {
        if (payload.target != null) {
          user._getOrCreateVoiceStream({
            0: 'normal',
            1: 'shout',
            2: 'whisper',
            31: 'loopback'
          }[payload.target]);
        } else if (user._voice) {
          user._voice.end();
          user._voice = null;
        }
      }
    }

    /**
     * Disconnect from the remote server.
     * Once disconnected, this client may not be used again.
     * Does nothing when not connected.
     */

  }, {
    key: 'disconnect',
    value: function disconnect() {
      if (this._disconnected) {
        return;
      }
      this._disconnected = true;
      this._voice.end();
      this._data.end();
      if (this._pc) {
        this._pc.close();
        this._pc = null;
      }
      clearInterval(this._pinger);

      this.emit('disconnected');
    }

    /**
     * Set preferred audio bitrate and samples per packet.
     *
     * The {@link PCMData} passed to the stream returned by {@link createVoiceStream} must
     * contain the appropriate amount of samples per channel for bandwidth control to
     * function as expected.
     *
     * If this method is never called or false is passed as one of the values, then the
     * samplesPerPacket are determined by inspecting the {@link PCMData} passed and the
     * bitrate is calculated from the maximum bitrate advertised by the server.
     *
     * @param {number} bitrate - Preferred audio bitrate, sensible values are 8k to 96k
     * @param {number} samplesPerPacket - Amount of samples per packet, valid values depend on the codec used but all should support 10ms (i.e. 480), 20ms, 40ms and 60ms
     */

  }, {
    key: 'setAudioQuality',
    value: function setAudioQuality(bitrate, samplesPerPacket) {
      this._preferredBitrate = bitrate;
      this._samplesPerPacket = samplesPerPacket;
    }

    /**
     * Calculate the actual bitrate taking into account maximum and preferred bitrate.
     */

  }, {
    key: 'getActualBitrate',
    value: function getActualBitrate(samplesPerPacket, sendPosition) {
      var bitrate = this.getPreferredBitrate(samplesPerPacket, sendPosition);
      var bandwidth = MumbleClient.calcEnforcableBandwidth(bitrate, samplesPerPacket, sendPosition);
      if (bandwidth <= this.maxBandwidth) {
        return bitrate;
      } else {
        return this.getMaxBitrate(samplesPerPacket, sendPosition);
      }
    }

    /**
     * Returns the preferred bitrate set by {@link setAudioQuality} or
     * {@link getMaxBitrate} if not set.
     */

  }, {
    key: 'getPreferredBitrate',
    value: function getPreferredBitrate(samplesPerPacket, sendPosition) {
      if (this._preferredBitrate) {
        return this._preferredBitrate;
      }
      return this.getMaxBitrate(samplesPerPacket, sendPosition);
    }

    /**
     * Calculate the maximum bitrate possible given the current server bandwidth limit.
     */

  }, {
    key: 'getMaxBitrate',
    value: function getMaxBitrate(samplesPerPacket, sendPosition) {
      var overhead = MumbleClient.calcEnforcableBandwidth(0, samplesPerPacket, sendPosition);
      return this.maxBandwidth - overhead;
    }

    /**
     * Calculate the bandwidth used if IP/UDP packets were used to transmit audio.
     * This matches the value used by Mumble servers to enforce bandwidth limits.
     * @returns {number} bits per second
     */

  }, {
    key: 'getChannel',


    /**
     * Find a channel by name.
     * If no such channel exists, return null.
     *
     * @param {string} name - The full name of the channel
     * @returns {?Channel}
     */
    value: function getChannel(name) {
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = this.channels[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var channel = _step4.value;

          if (channel.name === name) {
            return channel;
          }
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }

      return null;
    }
  }, {
    key: 'setSelfMute',
    value: function setSelfMute(mute) {
      var message = {
        name: 'UserState',
        payload: {
          session: this.self._id,
          self_mute: mute
        }
      };
      if (!mute) message.payload.self_deaf = false;
      this._send(message);
    }
  }, {
    key: 'setSelfDeaf',
    value: function setSelfDeaf(deaf) {
      var message = {
        name: 'UserState',
        payload: {
          session: this.self._id,
          self_deaf: deaf
        }
      };
      if (deaf) message.payload.self_mute = true;
      this._send(message);
    }
  }, {
    key: 'setSelfTexture',
    value: function setSelfTexture(texture) {
      this._send({
        name: 'UserState',
        payload: {
          session: this.self._id,
          texture: texture
        }
      });
    }
  }, {
    key: 'setSelfComment',
    value: function setSelfComment(comment) {
      this._send({
        name: 'UserState',
        payload: {
          session: this.self._id,
          comment: comment
        }
      });
    }
  }, {
    key: 'setPluginContext',
    value: function setPluginContext(context) {
      this._send({
        name: 'UserState',
        payload: {
          session: this.self._id,
          plugin_context: context
        }
      });
    }
  }, {
    key: 'setPluginIdentity',
    value: function setPluginIdentity(identity) {
      this._send({
        name: 'UserState',
        payload: {
          session: this.self._id,
          plugin_identity: identity
        }
      });
    }
  }, {
    key: 'setRecording',
    value: function setRecording(recording) {
      this._send({
        name: 'UserState',
        payload: {
          session: this.self._id,
          recording: recording
        }
      });
    }
  }, {
    key: 'getChannelById',
    value: function getChannelById(id) {
      return this._channelById[id];
    }
  }, {
    key: 'getUserById',
    value: function getUserById(id) {
      return this._userById[id];
    }
  }, {
    key: 'root',
    get: function get() {
      return this._channelById[0];
    }
  }, {
    key: 'connected',
    get: function get() {
      return !this._disconnected && this._dataStream != null;
    }
  }, {
    key: 'dataStats',
    get: function get() {
      return this._dataStats.getAll();
    }
  }, {
    key: 'voiceStats',
    get: function get() {
      return this._voiceStats.getAll();
    }
  }], [{
    key: 'calcEnforcableBandwidth',
    value: function calcEnforcableBandwidth(bitrate, samplesPerPacket, sendPosition) {
      // IP + UDP + Crypt + Header + SeqNum (VarInt) + Codec Header + Optional Position
      // Codec Header depends on codec:
      //  - Opus is always 4 (just the length as VarInt)
      //  - CELT/Speex depends on frames (10ms) per packet (1 byte each)
      var codecHeaderBytes = Math.max(4, samplesPerPacket / 480);
      var packetBytes = 20 + 8 + 4 + 1 + 4 + codecHeaderBytes + (sendPosition ? 12 : 0);
      var packetsPerSecond = 48000 / samplesPerPacket;
      return Math.round(packetBytes * 8 * packetsPerSecond + bitrate);
    }
  }]);

  return MumbleClient;
}(_events.EventEmitter);

exports.default = MumbleClient;