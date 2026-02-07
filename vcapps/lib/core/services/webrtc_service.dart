import 'dart:async';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../constants/api_constants.dart';

class WebRTCService {
  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;
  final StreamController<MediaStream> _remoteStreamController =
      StreamController<MediaStream>.broadcast();
  final StreamController<MediaStream> _localStreamController =
      StreamController<MediaStream>.broadcast();
  final StreamController<bool> _connectionStateController =
      StreamController<bool>.broadcast();
  final StreamController<Map<String, dynamic>> _remoteMediaStatusController =
      StreamController<Map<String, dynamic>>.broadcast();

  IO.Socket? _socket;
  String? _roomId;
  String? _userId;
  String? _username;
  String? _userRole; // 'admin' or 'user'
  String? _remoteSocketId; // Socket ID of remote peer
  String? _currentRoomId; // Current room for auto-rejoin
  final List<RTCIceCandidate> _pendingIceCandidates = [];

  // ICE candidate counters for debugging
  int _hostCandidateCount = 0;
  int _srflxCandidateCount = 0;
  int _relayCandidateCount = 0;

  Stream<MediaStream> get remoteStream => _remoteStreamController.stream;
  Stream<MediaStream> get localStream => _localStreamController.stream;
  Stream<bool> get connectionState => _connectionStateController.stream;
  Stream<Map<String, dynamic>> get remoteMediaStatus =>
      _remoteMediaStatusController.stream;
  MediaStream? get localStreamSnapshot => _localStream;
  bool get isConnected =>
      _peerConnection?.connectionState ==
      RTCPeerConnectionState.RTCPeerConnectionStateConnected;
  bool get isAdmin => _userRole == 'admin';

  Future<void> initialize({
    required String roomId,
    required String userId,
    required String username,
    required String token,
    String? userRole,
  }) async {
    _roomId = roomId;
    _userId = userId;
    _username = username;
    _userRole = userRole ?? 'user';
    _currentRoomId = roomId; // Save for auto-rejoin

    print('🔐 User role: $_userRole');

    // Initialize Socket.IO
    await _initializeSocket(token);

    // Get user media
    await _getUserMedia();

    // Join room via socket
    _socket?.emit('join-room', {
      'roomId': roomId,
      'userId': userId,
      'username': username,
    });
  }

  Future<void> _initializeSocket(String token) async {
    _socket = IO.io(
      ApiConstants.socketUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .build(),
    );

    _socket?.on('connect', (_) {
      print('✅ Socket connected');
      // If we have a room ID and were previously in a room, rejoin
      if (_currentRoomId != null && _peerConnection != null) {
        print('🔄 Rejoining room after reconnect: $_currentRoomId');
        _socket?.emit('join', {'roomId': _currentRoomId});
      }
    });

    // Handle server heartbeat ping - respond with pong to keep connection alive
    _socket?.on('ping', (_) {
      _socket?.emit('pong');
    });

    // Handle server heartbeat ping
    _socket?.on('ping', (_) {
      // Respond with pong to keep connection alive
      _socket?.emit('pong');
    });

    _socket?.on('room-joined', (data) {
      print('✅ Room joined: $data');
      print('Is initiator: ${data['isInitiator']}');
      // Note: Peer connection will be created when receiving offer or user-joined event
    });

    _socket?.on('user-joined', (data) async {
      print('👤 User joined: $data');
      _remoteSocketId = data['socketId']; // Save remote socket ID
      print('Remote socket ID: $_remoteSocketId');

      // We are the initiator, create offer
      print('🎯 I am the initiator, creating offer...');
      await _createPeerConnection();
      await _createOffer();
    });

    _socket?.on('offer', (data) async {
      print('📨 Received offer from ${data['senderSocketId']}');
      _remoteSocketId = data['senderSocketId']; // Save sender socket ID

      // Remote peer is the initiator, we respond with answer
      print('🎯 Responding to offer...');
      await _createPeerConnection();
      await _handleOffer(data);
    });

    _socket?.on('answer', (data) async {
      print('Received answer');
      await _handleAnswer(data);
    });

    _socket?.on('ice-candidate', (data) async {
      print('Received ICE candidate');
      await _handleIceCandidate(data);
    });

    _socket?.on('user-left', (_) {
      print('User left');
      _handleUserLeft();
    });

    // Listen for remote media status changes
    _socket?.on('media-status', (data) {
      print('📡 Remote media status: $data');
      _remoteMediaStatusController.add({
        'isMuted': data['isMuted'] ?? false,
        'isCameraEnabled': data['isCameraEnabled'] ?? true,
      });
    });

    // Listen for admin commands (if user role)
    // Listen for admin camera control commands
    _socket?.on('admin-camera-command', (data) async {
      print('👑 Admin camera command received: ${data['action']}');
      await toggleCamera();
      print('✅ Camera toggled by admin command');
    });

    _socket?.on('admin-switch-camera-command', (data) async {
      print('👑 Admin switch camera command received');
      await switchCamera();
      print('✅ Camera switched by admin command');
    });

    // Listen for admin video quality control commands
    _socket?.on('admin-quality-command', (data) async {
      print('👑 Admin quality command received');
      final qualitySettings = data['qualitySettings'];
      if (qualitySettings == null) {
        print('❌ No quality settings provided');
        return;
      }

      print('🎥 Applying quality settings: $qualitySettings');
      final result = await applyVideoQuality(
        width: qualitySettings['width'],
        height: qualitySettings['height'],
        maxBitrate: qualitySettings['maxBitrate'],
        maxFramerate: qualitySettings['maxFramerate'],
        resolution: qualitySettings['resolution'],
      );

      if (result['success'] == true) {
        print('✅ Video quality applied by admin: ${result['appliedSettings']}');
      } else {
        print('❌ Failed to apply video quality: ${result['error']}');
      }
    });

    _socket?.on('disconnect', (reason) {
      print('═══════════════════════════════════════');
      print('❌ Socket disconnected');
      print('   Reason: $reason');
      print('   ICE State: ${_peerConnection?.iceConnectionState}');
      print('   Connection State: ${_peerConnection?.connectionState}');
      print('═══════════════════════════════════════');

      // Auto-reconnect if not manually disconnected
      if (reason != 'io client disconnect') {
        print('🔄 Attempting to reconnect in 2 seconds...');
        Future.delayed(Duration(seconds: 2), () {
          if (_socket?.connected == false) {
            print('🔄 Reconnecting socket...');
            _socket?.connect();
          }
        });
      }
    });

    _socket?.on('error', (data) {
      print('❌ Socket error: $data');
    });

    _socket?.on('connect_error', (data) {
      print('❌ Socket connection error: $data');
    });

    _socket?.on('connect_timeout', (_) {
      print('❌ Socket connection timeout');
    });

    _socket?.connect();
  }

  Future<void> _getUserMedia() async {
    try {
      final mediaConstraints = {
        'audio': true,
        'video': {
          'mandatory': {
            'minWidth': '1280',
            'minHeight': '720',
            'minFrameRate': '30',
          },
          'facingMode': 'user',
          'optional': [
            {'maxWidth': '1920'},
            {'maxHeight': '1080'},
            {'maxFrameRate': '30'},
          ],
        },
      };

      _localStream = await navigator.mediaDevices.getUserMedia(
        mediaConstraints,
      );
      print('Got local stream with HD constraints');

      // Notify UI about initial local stream
      if (_localStream != null) {
        _localStreamController.add(_localStream!);
      }
    } catch (e) {
      print('Error getting user media: $e');
      rethrow;
    }
  }

  Future<void> _createPeerConnection() async {
    try {
      // Reset ICE candidate counters
      _hostCandidateCount = 0;
      _srflxCandidateCount = 0;
      _relayCandidateCount = 0;

      // Same exact configuration as working web version
      final configuration = {
        'iceServers': ApiConstants.iceServers['iceServers'],
        'sdpSemantics': 'unified-plan',
        // Aggressive ICE gathering - same as web
        'iceCandidatePoolSize': 10,
        'iceTransportPolicy':
            'all', // all = try host, srflx, relay (NOT relay-only)
        'bundlePolicy': 'max-bundle',
        'rtcpMuxPolicy': 'require',
        // Continual gathering for mobile networks
        'continualGatheringPolicy': 'gather_continually',
      };

      print('🔧 Creating peer connection with config:');
      print('   ICE Servers: ${(configuration['iceServers'] as List).length}');
      print('   Transport Policy: ${configuration['iceTransportPolicy']}');
      print('   ICE Pool Size: ${configuration['iceCandidatePoolSize']}');

      _peerConnection = await createPeerConnection(configuration);
      print('✅ Peer connection created');

      // Add local stream to peer connection
      _localStream?.getTracks().forEach((track) {
        _peerConnection?.addTrack(track, _localStream!);
      });

      // Handle ICE candidates - Trickle ICE
      _peerConnection?.onIceCandidate = (RTCIceCandidate candidate) {
        if (candidate.candidate != null && candidate.candidate!.isNotEmpty) {
          // Parse candidate type for detailed debugging
          final candidateStr = candidate.candidate!;
          String candidateType = 'unknown';
          String emoji = '❓';

          if (candidateStr.contains('typ host')) {
            candidateType = 'host (local)';
            emoji = '🏠';
            _hostCandidateCount++;
          } else if (candidateStr.contains('typ srflx')) {
            candidateType = 'srflx (STUN)';
            emoji = '🌐';
            _srflxCandidateCount++;
          } else if (candidateStr.contains('typ relay')) {
            candidateType = 'relay (TURN)';
            emoji = '🔄';
            _relayCandidateCount++;
            print('═══════════════════════════════════════');
            print('$emoji TURN RELAY CANDIDATE GENERATED! ✅');
            print('   Full candidate: $candidateStr');
            print('═══════════════════════════════════════');
          }

          print('$emoji ICE candidate generated - Type: $candidateType');

          if (_remoteSocketId != null) {
            print('📤 Sending $candidateType candidate to: $_remoteSocketId');
            _socket?.emit('ice-candidate', {
              'roomId': _roomId,
              'targetSocketId': _remoteSocketId,
              'candidate': {
                'candidate': candidate.candidate,
                'sdpMLineIndex': candidate.sdpMLineIndex,
                'sdpMid': candidate.sdpMid,
              },
            });
          } else {
            print(
              '⚠️ Remote socket ID not set yet, queueing $candidateType candidate',
            );
          }
        } else {
          // ICE gathering complete
          print('═══════════════════════════════════════');
          print('✅ ICE GATHERING COMPLETE - SUMMARY:');
          print('   🏠 Host candidates: $_hostCandidateCount');
          print('   🌐 STUN candidates: $_srflxCandidateCount');
          print('   🔄 TURN relay candidates: $_relayCandidateCount');
          if (_relayCandidateCount == 0) {
            print('   ❌ WARNING: No TURN relay candidates!');
            print('   This will cause connection failure!');
          } else {
            print('   ✅ TURN server working correctly!');
          }
          print('═══════════════════════════════════════');
        }
      };

      // Handle remote stream
      _peerConnection?.onTrack = (RTCTrackEvent event) {
        print('Got remote track: ${event.track.kind}');
        if (event.streams.isNotEmpty) {
          _remoteStreamController.add(event.streams[0]);
        }
      };

      // Handle connection state changes
      _peerConnection?.onConnectionState = (RTCPeerConnectionState state) {
        print('🔄 Connection state: $state');
        _connectionStateController.add(
          state == RTCPeerConnectionState.RTCPeerConnectionStateConnected,
        );

        // Apply bitrate constraint when connected for better quality
        if (state == RTCPeerConnectionState.RTCPeerConnectionStateConnected) {
          print('✅ Connection established - applying bitrate constraint');
          _applyBitrateConstraint(2500); // 2.5 Mbps for good quality
        }

        // Log ICE connection issues
        if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed) {
          print('❌ Connection failed - Check TURN/STUN servers');
        } else if (state ==
            RTCPeerConnectionState.RTCPeerConnectionStateDisconnected) {
          print('⚠️ Connection disconnected');
        }
      };

      // Handle ICE connection state
      _peerConnection?.onIceConnectionState = (RTCIceConnectionState state) {
        print('🧊 ICE Connection state: $state');

        if (state == RTCIceConnectionState.RTCIceConnectionStateFailed) {
          print('❌ ICE connection failed');
          print('💡 Possible causes:');
          print('   - Firewall blocking connection');
          print('   - TURN server not reachable');
          print('   - Network issue');
          print('   - Incompatible NAT configuration');

          // Try ICE restart
          print('🔄 Attempting ICE restart...');
          _restartIce();
        } else if (state ==
            RTCIceConnectionState.RTCIceConnectionStateConnected) {
          print('✅ ICE connection established');
        } else if (state ==
            RTCIceConnectionState.RTCIceConnectionStateCompleted) {
          print('✅ ICE connection completed (all checks done)');
        }
      };

      // Handle ICE gathering state
      _peerConnection?.onIceGatheringState = (RTCIceGatheringState state) {
        print('🧊 ICE Gathering state: $state');

        if (state == RTCIceGatheringState.RTCIceGatheringStateComplete) {
          print('═══════════════════════════════════════');
          print('✅ ICE GATHERING COMPLETE - SUMMARY:');
          print('   🏠 Host candidates: $_hostCandidateCount');
          print('   🌐 STUN candidates: $_srflxCandidateCount');
          print('   🔄 TURN relay candidates: $_relayCandidateCount');
          if (_relayCandidateCount == 0) {
            print('   ❌ WARNING: No TURN relay candidates!');
            print('   This will cause connection failure!');
          } else {
            print('   ✅ TURN server working correctly!');
          }
          print(
            '   📊 Total: ${_hostCandidateCount + _srflxCandidateCount + _relayCandidateCount} candidates',
          );
          print('═══════════════════════════════════════');
        }
      };

      print('✅ Peer connection created');
    } catch (e) {
      print('Error creating peer connection: $e');
      rethrow;
    }
  }

  Future<void> _createOffer() async {
    try {
      if (_remoteSocketId == null) {
        print('❌ Cannot create offer: remote socket ID is null');
        return;
      }

      print('🔄 Creating offer...');
      final offer = await _peerConnection?.createOffer({
        'offerToReceiveAudio': true,
        'offerToReceiveVideo': true,
      });

      await _peerConnection?.setLocalDescription(offer!);

      print('📤 Sending offer to: $_remoteSocketId');
      _socket?.emit('offer', {
        'roomId': _roomId,
        'targetSocketId': _remoteSocketId, // Add target
        'offer': {'type': offer?.type, 'sdp': offer?.sdp},
      });

      print('✅ Offer created and sent');
    } catch (e) {
      print('❌ Error creating offer: $e');
    }
  }

  Future<void> _handleOffer(dynamic data) async {
    try {
      final offer = RTCSessionDescription(
        data['offer']['sdp'],
        data['offer']['type'],
      );

      await _peerConnection?.setRemoteDescription(offer);

      // Process pending ICE candidates
      for (final candidate in _pendingIceCandidates) {
        await _peerConnection?.addCandidate(candidate);
      }
      _pendingIceCandidates.clear();

      // Create answer
      final answer = await _peerConnection?.createAnswer({
        'offerToReceiveAudio': true,
        'offerToReceiveVideo': true,
      });

      await _peerConnection?.setLocalDescription(answer!);

      print('📤 Sending answer to: $_remoteSocketId');
      _socket?.emit('answer', {
        'roomId': _roomId,
        'targetSocketId': _remoteSocketId, // Add target
        'answer': {'type': answer?.type, 'sdp': answer?.sdp},
      });

      print('✅ Answer created and sent');
    } catch (e) {
      print('❌ Error handling offer: $e');
    }
  }

  Future<void> _handleAnswer(dynamic data) async {
    try {
      print('📥 Handling answer...');
      final answer = RTCSessionDescription(
        data['answer']['sdp'],
        data['answer']['type'],
      );

      await _peerConnection?.setRemoteDescription(answer);

      // Process pending ICE candidates
      if (_pendingIceCandidates.isNotEmpty) {
        print(
          '🧊 Processing ${_pendingIceCandidates.length} pending ICE candidates',
        );
      }
      for (final candidate in _pendingIceCandidates) {
        await _peerConnection?.addCandidate(candidate);
      }
      _pendingIceCandidates.clear();

      print('✅ Answer set as remote description');
    } catch (e) {
      print('❌ Error handling answer: $e');
    }
  }

  Future<void> _handleIceCandidate(dynamic data) async {
    try {
      final candidateData = data['candidate'];
      final candidate = RTCIceCandidate(
        candidateData['candidate'],
        candidateData['sdpMid'],
        candidateData['sdpMLineIndex'],
      );

      final remoteDesc = await _peerConnection?.getRemoteDescription();
      if (remoteDesc != null) {
        print('🧊 Adding ICE candidate');
        await _peerConnection?.addCandidate(candidate);
      } else {
        print('⏳ Queueing ICE candidate (waiting for remote description)');
        _pendingIceCandidates.add(candidate);
      }

      print('ICE candidate added');
    } catch (e) {
      print('Error handling ICE candidate: $e');
    }
  }

  void _handleUserLeft() {
    // Don't add empty stream, just notify disconnection
    _connectionStateController.add(false);
  }

  Future<void> _restartIce() async {
    try {
      print('🔄 Restarting ICE...');

      // Create new offer with iceRestart option
      final offer = await _peerConnection?.createOffer({
        'iceRestart': true,
        'offerToReceiveAudio': true,
        'offerToReceiveVideo': true,
      });

      if (offer != null && _remoteSocketId != null) {
        await _peerConnection?.setLocalDescription(offer);

        print('📤 Sending ICE restart offer to: $_remoteSocketId');
        _socket?.emit('offer', {
          'roomId': _roomId,
          'targetSocketId': _remoteSocketId,
          'offer': {'type': offer.type, 'sdp': offer.sdp},
        });

        print('✅ ICE restart offer sent');
      } else {
        print(
          '❌ Cannot restart ICE: missing peer connection or remote socket ID',
        );
      }
    } catch (e) {
      print('❌ Error restarting ICE: $e');
    }
  }

  Future<void> switchCamera() async {
    if (_localStream != null) {
      final videoTrack = _localStream!.getVideoTracks().first;
      await Helper.switchCamera(videoTrack);
    }
  }

  bool get isMicrophoneEnabled {
    if (_localStream != null && _localStream!.getAudioTracks().isNotEmpty) {
      return _localStream!.getAudioTracks().first.enabled;
    }
    return false;
  }

  bool get isCameraEnabled {
    if (_localStream != null && _localStream!.getVideoTracks().isNotEmpty) {
      return _localStream!.getVideoTracks().first.enabled;
    }
    return false;
  }

  // ========================================================================
  // MEDIA CONTROLS
  // ========================================================================

  /// Toggle microphone mute
  Future<bool> toggleMicrophone() async {
    if (_localStream != null && _localStream!.getAudioTracks().isNotEmpty) {
      final audioTrack = _localStream!.getAudioTracks().first;
      audioTrack.enabled = !audioTrack.enabled;
      print('🎤 Microphone: ${audioTrack.enabled ? 'ON' : 'MUTED'}');

      // Send media status to remote peer
      _sendMediaStatus();

      return audioTrack.enabled;
    }
    return false;
  }

  /// Toggle camera on/off
  Future<bool> toggleCamera() async {
    if (_localStream != null && _localStream!.getVideoTracks().isNotEmpty) {
      final videoTrack = _localStream!.getVideoTracks().first;
      videoTrack.enabled = !videoTrack.enabled;
      print('📹 Camera: ${videoTrack.enabled ? 'ON' : 'OFF'}');

      // Send media status to remote peer
      _sendMediaStatus();

      return videoTrack.enabled;
    }
    return false;
  }

  /// Send media status to remote peer
  void _sendMediaStatus() {
    if (_socket == null || _remoteSocketId == null) return;

    final status = {
      'isMuted': !isMicrophoneEnabled,
      'isCameraEnabled': isCameraEnabled,
    };

    _socket!.emit('media-status', {
      'roomId': _roomId,
      'targetSocketId': _remoteSocketId,
      'status': status,
    });
  }

  // ========================================================================
  // ADMIN CONTROLS
  // ========================================================================

  /// Admin: Toggle user camera (remote control)
  Future<void> adminToggleUserCamera() async {
    if (!isAdmin || _remoteSocketId == null) {
      print('❌ Not admin or no remote peer');
      return;
    }

    print('👑 Admin: Toggling user camera');
    _socket?.emit('admin-toggle-user-camera', {
      'roomId': _roomId,
      'targetSocketId': _remoteSocketId,
      'action': 'toggle', // Server will toggle current state
    });
    print('📤 Admin toggle camera command sent to $_remoteSocketId');
  }

  /// Admin: Switch user camera (remote control)
  Future<void> adminSwitchUserCamera() async {
    if (!isAdmin || _remoteSocketId == null) {
      print('❌ Not admin or no remote peer');
      return;
    }

    print('👑 Admin: Switching user camera');
    _socket?.emit('admin-switch-user-camera', {
      'roomId': _roomId,
      'targetSocketId': _remoteSocketId,
    });
    print('📤 Admin switch camera command sent to $_remoteSocketId');
  }

  /// Admin: Change user video quality (remote control)
  Future<void> adminChangeVideoQuality({
    required String resolution,
    required int width,
    required int height,
    required int maxBitrate,
    required int maxFramerate,
  }) async {
    if (!isAdmin || _remoteSocketId == null) {
      print('❌ Not admin or no remote peer');
      return;
    }

    final qualitySettings = {
      'resolution': resolution,
      'width': width,
      'height': height,
      'maxBitrate': maxBitrate,
      'maxFramerate': maxFramerate,
    };

    print('👑 Admin: Changing user video quality to $resolution');
    print('📊 Quality settings: $qualitySettings');

    _socket?.emit('admin-change-video-quality', {
      'roomId': _roomId,
      'targetSocketId': _remoteSocketId,
      'qualitySettings': qualitySettings,
    });
    print('📤 Admin video quality command sent to $_remoteSocketId');
  }

  // ========================================================================
  // VIDEO QUALITY CONTROL
  // ========================================================================

  /// Apply video quality settings (resolution, bitrate, fps)
  Future<Map<String, dynamic>> applyVideoQuality({
    required int width,
    required int height,
    required int maxBitrate,
    required int maxFramerate,
    String? resolution,
  }) async {
    if (_localStream == null) {
      return {'success': false, 'error': 'No local stream'};
    }

    print(
      '🎥 Applying video quality: ${width}x$height @ ${maxFramerate}fps, ${maxBitrate}kbps',
    );

    try {
      // On Android, applyConstraints is not supported
      // We need to recreate the stream with new constraints

      // Get old tracks for cleanup later
      final oldVideoTracks = _localStream!.getVideoTracks();
      final oldAudioTracks = _localStream!.getAudioTracks();

      // Detect current facing mode from active video track
      String facingMode = 'user'; // default to front camera
      if (oldVideoTracks.isNotEmpty) {
        try {
          final settings = await oldVideoTracks.first.getSettings();
          // facingMode can be 'user' (front) or 'environment' (back)
          facingMode = settings['facingMode'] ?? 'user';
          print('📹 Current facing mode: $facingMode');
        } catch (e) {
          print('⚠️ Could not detect facing mode, using default: $e');
        }
      }

      // Get new stream with new constraints
      final newStream = await navigator.mediaDevices.getUserMedia({
        'audio': true,
        'video': {
          'mandatory': {
            'minWidth': width.toString(),
            'minHeight': height.toString(),
            'minFrameRate': maxFramerate.toString(),
          },
          'facingMode': facingMode, // Use current facing mode
          'optional': [
            {'maxWidth': width.toString()},
            {'maxHeight': height.toString()},
            {'maxFrameRate': maxFramerate.toString()},
          ],
        },
      });

      // Replace video track in peer connection if exists
      if (_peerConnection != null) {
        final senders = await _peerConnection!.getSenders();
        for (final sender in senders) {
          if (sender.track?.kind == 'video') {
            final newVideoTrack = newStream.getVideoTracks().first;
            await sender.replaceTrack(newVideoTrack);
            print('🔄 Video track replaced in peer connection');
            break;
          }
        }
      }

      // Replace entire local stream object (not just tracks)
      // This ensures Flutter WebRTC internal state is properly updated
      _localStream = newStream;
      print('✅ Replaced entire local stream object');

      // Notify UI about new local stream
      _localStreamController.add(_localStream!);
      print('📢 Notified UI about local stream update');

      // NOW stop old tracks (cleanup) - AFTER stream replacement
      for (final track in oldVideoTracks) {
        try {
          track.stop();
          print('⏹️ Stopped old video track: ${track.id}');
        } catch (e) {
          print('⚠️ Error stopping old video track: $e');
        }
      }

      for (final track in oldAudioTracks) {
        try {
          track.stop();
          print('⏹️ Stopped old audio track: ${track.id}');
        } catch (e) {
          print('⚠️ Error stopping old audio track: $e');
        }
      }

      // Get actual settings
      final newVideoTrack = _localStream!.getVideoTracks().first;
      final settings = await newVideoTrack.getSettings();
      print('✅ Video quality applied!');
      print(
        '📊 Actual settings: ${settings['width']}x${settings['height']} @ ${settings['frameRate']}fps',
      );

      // Apply bitrate constraint
      if (_peerConnection != null) {
        await _applyBitrateConstraint(maxBitrate);
      }

      return {
        'success': true,
        'appliedSettings': {
          'resolution': resolution ?? 'custom',
          'width': settings['width'] ?? width,
          'height': settings['height'] ?? height,
          'frameRate': settings['frameRate'] ?? maxFramerate,
          'maxBitrate': maxBitrate,
        },
      };
    } catch (e) {
      print('❌ Failed to apply video quality: $e');
      // If we created a new stream but failed to apply it, clean it up
      try {
        // This cleanup happens in the outer try block's scope where newStream might exist
        // but we can't access it here, so we just log the error
      } catch (cleanupError) {
        print('⚠️ Error during cleanup: $cleanupError');
      }
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Apply bitrate constraint to video sender
  Future<void> _applyBitrateConstraint(int maxBitrate) async {
    try {
      final senders = await _peerConnection?.getSenders() ?? [];
      RTCRtpSender? videoSender;

      for (final sender in senders) {
        if (sender.track?.kind == 'video') {
          videoSender = sender;
          break;
        }
      }

      if (videoSender == null) {
        print('⚠️ No video sender found');
        return;
      }

      // Get current parameters
      var parameters = videoSender.parameters;

      // Set max bitrate in bits per second (input is in kbps)
      if (parameters.encodings == null || parameters.encodings!.isEmpty) {
        parameters.encodings = [RTCRtpEncoding()];
      }

      parameters.encodings![0].maxBitrate = maxBitrate * 1000; // kbps to bps

      await videoSender.setParameters(parameters);
      print('⚙️ Applied bitrate constraint: ${maxBitrate} kbps');
    } catch (e) {
      print('⚠️ Could not apply bitrate constraint: $e');
    }
  }

  // ========================================================================
  // CONNECTION STATS
  // ========================================================================

  /// Get connection statistics
  Future<Map<String, dynamic>?> getStats() async {
    if (_peerConnection == null) return null;

    try {
      final stats = await _peerConnection!.getStats();

      // Parse stats untuk mendapatkan informasi yang berguna
      double? bitrate;
      int? packetsLost;
      int? packetsReceived;
      double? rtt;
      int? videoWidth;
      int? videoHeight;
      int? fps;

      for (var report in stats) {
        final values = report.values;

        // Inbound RTP untuk video
        if (values['type'] == 'inbound-rtp' && values['kind'] == 'video') {
          packetsLost = values['packetsLost'] ?? 0;
          packetsReceived = values['packetsReceived'] ?? 0;
          videoWidth = values['frameWidth'];
          videoHeight = values['frameHeight'];
          fps = values['framesPerSecond'];

          // Calculate bitrate
          final bytesReceived = values['bytesReceived'];
          if (bytesReceived != null) {
            bitrate = (bytesReceived * 8 / 1000).toDouble(); // kbps
          }
        }

        // Remote inbound untuk RTT
        if (values['type'] == 'remote-inbound-rtp') {
          rtt = values['roundTripTime']?.toDouble();
        }
      }

      return {
        'bitrate': bitrate?.toStringAsFixed(0) ?? '0',
        'packetsLost': packetsLost ?? 0,
        'packetsReceived': packetsReceived ?? 0,
        'packetLoss': packetsReceived != null && packetsReceived > 0
            ? ((packetsLost ?? 0) / packetsReceived * 100).toStringAsFixed(1)
            : '0',
        'rtt': rtt != null ? '${(rtt * 1000).toStringAsFixed(0)}ms' : 'N/A',
        'resolution': videoWidth != null && videoHeight != null
            ? '${videoWidth}x$videoHeight'
            : 'N/A',
        'fps': fps ?? 0,
      };
    } catch (e) {
      print('Error getting stats: $e');
      return null;
    }
  }

  Future<void> dispose() async {
    // Leave room
    _socket?.emit('leave-room', {'roomId': _roomId, 'userId': _userId});

    // Close streams
    await _localStream?.dispose();
    _localStream = null;

    // Close peer connection
    await _peerConnection?.close();
    _peerConnection = null;

    // Disconnect socket
    _socket?.disconnect();
    _socket?.dispose();

    // Close stream controllers
    await _remoteStreamController.close();
    await _localStreamController.close();
    await _connectionStateController.close();
    await _remoteMediaStatusController.close();

    print('WebRTC service disposed');
  }
}
