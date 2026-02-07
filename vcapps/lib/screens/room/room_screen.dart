import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../core/services/api_service.dart';
import '../../core/services/webrtc_service.dart';
import '../../core/theme/app_theme.dart';

class RoomScreen extends StatefulWidget {
  final String roomId;
  final String? roomName;

  const RoomScreen({
    super.key,
    required this.roomId,
    this.roomName,
  });

  @override
  State<RoomScreen> createState() => _RoomScreenState();
}

class _RoomScreenState extends State<RoomScreen> {
  final WebRTCService _webrtcService = WebRTCService();
  final RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  final RTCVideoRenderer _remoteRenderer = RTCVideoRenderer();

  bool _isInitializing = true;
  bool _isConnected = false;
  bool _isMicEnabled = true;
  bool _isCameraEnabled = true;
  bool _showControls = true;
  String _remoteUsername = 'Menunggu...';

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  @override
  void dispose() {
    _localRenderer.dispose();
    _remoteRenderer.dispose();
    _webrtcService.dispose();
    super.dispose();
  }

  Future<void> _initialize() async {
    try {
      // Request permissions
      await _requestPermissions();

      // Initialize renderers
      await _localRenderer.initialize();
      await _remoteRenderer.initialize();

      // Get user data
      final userData = await ApiService.getUser();
      final token = await ApiService.getToken();

      if (userData == null || token == null) {
        throw Exception('User not authenticated');
      }

      // Initialize WebRTC
      await _webrtcService.initialize(
        roomId: widget.roomId,
        userId: userData['id'] ?? userData['_id'],
        username: userData['username'],
        token: token,
      );

      // Set local stream
      _localRenderer.srcObject = _webrtcService.localStream;

      // Listen to remote stream
      _webrtcService.remoteStream.listen((stream) {
        if (mounted) {
          setState(() {
            _remoteRenderer.srcObject = stream;
            if (stream.getTracks().isNotEmpty) {
              _remoteUsername = 'Remote User';
            }
          });
        }
      });

      // Listen to connection state
      _webrtcService.connectionState.listen((isConnected) {
        if (mounted) {
          setState(() {
            _isConnected = isConnected;
          });
        }
      });

      setState(() {
        _isInitializing = false;
      });
    } catch (e) {
      print('Error initializing: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
        Navigator.pop(context);
      }
    }
  }

  Future<void> _requestPermissions() async {
    final cameraStatus = await Permission.camera.request();
    final microphoneStatus = await Permission.microphone.request();

    if (!cameraStatus.isGranted || !microphoneStatus.isGranted) {
      throw Exception('Camera and microphone permissions are required');
    }
  }

  void _toggleMicrophone() {
    _webrtcService.toggleMicrophone();
    setState(() {
      _isMicEnabled = _webrtcService.isMicrophoneEnabled;
    });
  }

  void _toggleCamera() {
    _webrtcService.toggleCamera();
    setState(() {
      _isCameraEnabled = _webrtcService.isCameraEnabled;
    });
  }

  void _switchCamera() {
    _webrtcService.switchCamera();
  }

  void _leaveRoom() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Keluar dari Room'),
        content: const Text('Apakah Anda yakin ingin keluar dari video call?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context); // Close dialog
              Navigator.pop(context); // Exit room screen
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorColor,
            ),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );
  }

  void _copyRoomId() {
    Clipboard.setData(ClipboardData(text: widget.roomId));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Room ID disalin ke clipboard'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isInitializing) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: AppTheme.primaryGreen),
              SizedBox(height: 16),
              Text(
                'Menginisialisasi...',
                style: TextStyle(color: Colors.white),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: () {
          setState(() {
            _showControls = !_showControls;
          });
        },
        child: Stack(
          children: [
            // Remote Video (Fullscreen)
            SizedBox.expand(
              child: _remoteRenderer.srcObject != null &&
                      _remoteRenderer.srcObject!.getTracks().isNotEmpty
                  ? RTCVideoView(
                      _remoteRenderer,
                      objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain,
                      mirror: false,
                    )
                  : Container(
                      color: AppTheme.darkBgPrimary,
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 80,
                              height: 80,
                              decoration: BoxDecoration(
                                color: AppTheme.primaryGreen.withOpacity(0.2),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.person,
                                size: 48,
                                color: AppTheme.primaryGreen,
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              _remoteUsername,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Room ID: ${widget.roomId}',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.7),
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton.icon(
                              onPressed: _copyRoomId,
                              icon: const Icon(Icons.copy, size: 16),
                              label: const Text('Copy ID'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.primaryGreen.withOpacity(0.2),
                                foregroundColor: AppTheme.primaryGreen,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
            ),

            // Local Video (PIP - Picture in Picture)
            Positioned(
              top: 48,
              right: 16,
              child: Container(
                width: 120,
                height: 160,
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppTheme.primaryGreen,
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.5),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Stack(
                    children: [
                      if (_isCameraEnabled)
                        RTCVideoView(
                          _localRenderer,
                          objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                          mirror: true,
                        )
                      else
                        Container(
                          color: AppTheme.darkBgTertiary,
                          child: const Center(
                            child: Icon(
                              Icons.videocam_off,
                              color: Colors.white,
                              size: 32,
                            ),
                          ),
                        ),
                      Positioned(
                        bottom: 4,
                        left: 4,
                        right: 4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.6),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'Anda',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Top bar
            if (_showControls)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: EdgeInsets.only(
                    top: MediaQuery.of(context).padding.top + 8,
                    left: 16,
                    right: 16,
                    bottom: 16,
                  ),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withOpacity(0.7),
                        Colors.transparent,
                      ],
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: _isConnected
                              ? AppTheme.successColor.withOpacity(0.2)
                              : AppTheme.warningColor.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: _isConnected
                                ? AppTheme.successColor
                                : AppTheme.warningColor,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: _isConnected
                                    ? AppTheme.successColor
                                    : AppTheme.warningColor,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              _isConnected ? 'Terhubung' : 'Menunggu...',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      if (widget.roomName != null)
                        Flexible(
                          child: Text(
                            widget.roomName!,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                  ),
                ),
              ),

            // Bottom controls
            if (_showControls)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: EdgeInsets.only(
                    left: 16,
                    right: 16,
                    bottom: MediaQuery.of(context).padding.bottom + 16,
                    top: 16,
                  ),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        Colors.black.withOpacity(0.7),
                        Colors.transparent,
                      ],
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      // Microphone toggle
                      _buildControlButton(
                        icon: _isMicEnabled ? Icons.mic : Icons.mic_off,
                        onPressed: _toggleMicrophone,
                        backgroundColor: _isMicEnabled
                            ? AppTheme.darkBgTertiary
                            : AppTheme.errorColor,
                      ),
                      
                      // Camera toggle
                      _buildControlButton(
                        icon: _isCameraEnabled ? Icons.videocam : Icons.videocam_off,
                        onPressed: _toggleCamera,
                        backgroundColor: _isCameraEnabled
                            ? AppTheme.darkBgTertiary
                            : AppTheme.errorColor,
                      ),
                      
                      // Switch camera
                      _buildControlButton(
                        icon: Icons.flip_camera_ios,
                        onPressed: _switchCamera,
                        backgroundColor: AppTheme.darkBgTertiary,
                      ),
                      
                      // Leave room
                      _buildControlButton(
                        icon: Icons.call_end,
                        onPressed: _leaveRoom,
                        backgroundColor: AppTheme.errorColor,
                        size: 64,
                        iconSize: 32,
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildControlButton({
    required IconData icon,
    required VoidCallback onPressed,
    required Color backgroundColor,
    double size = 56,
    double iconSize = 28,
  }) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: backgroundColor,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: IconButton(
        icon: Icon(icon, size: iconSize),
        color: Colors.white,
        onPressed: onPressed,
      ),
    );
  }
}
