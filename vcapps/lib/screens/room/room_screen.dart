import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';import 'dart:async';import '../../core/services/api_service.dart';
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
  bool _isCameraVisuallyOff = true; // Default: camera visual off (like web)
  bool _showControls = true;
  bool _showStats = false;
  bool _isRemoteBlank = false; // Admin: blank remote video
  String _remoteUsername = 'Menunggu...';
  
  // Remote media status
  bool _isRemoteMuted = false;
  bool _isRemoteCameraEnabled = true;
  
  // Connection stats
  Timer? _statsTimer;
  Timer? _controlsTimer;
  Map<String, dynamic> _stats = {
    'bitrate': '0',
    'packetLoss': '0',
    'rtt': 'N/A',
    'resolution': 'N/A',
    'fps': 0,
  };

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  @override
  void dispose() {
    _statsTimer?.cancel();
    _controlsTimer?.cancel();
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
        userRole: userData['role'] ?? 'user',
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
          
          // Start stats collection when connected
          if (isConnected && _statsTimer == null) {
            _startStatsCollection();
          } else if (!isConnected) {
            _stopStatsCollection();
          }
        }
      });

      // Listen to remote media status
      _webrtcService.remoteMediaStatus.listen((status) {
        if (mounted) {
          setState(() {
            _isRemoteMuted = status['isMuted'] ?? false;
            _isRemoteCameraEnabled = status['isCameraEnabled'] ?? true;
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

  Future<void> _toggleMicrophone() async {
    final enabled = await _webrtcService.toggleMicrophone();
    setState(() {
      _isMicEnabled = enabled;
    });
  }

  Future<void> _toggleCamera() async {
    final enabled = await _webrtcService.toggleCamera();
    setState(() {
      _isCameraEnabled = enabled;
      _isCameraVisuallyOff = !enabled; // Visual follows actual
    });
  }

  void _switchCamera() {
    _webrtcService.switchCamera();
  }

  // Admin controls
  void _adminToggleUserCamera() {
    if (_webrtcService.isAdmin) {
      _webrtcService.adminToggleUserCamera();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Toggle kamera user'),
          duration: Duration(seconds: 1),
        ),
      );
    }
  }

  void _adminSwitchUserCamera() {
    if (_webrtcService.isAdmin) {
      _webrtcService.adminSwitchUserCamera();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Switch kamera user'),
          duration: Duration(seconds: 1),
        ),
      );
    }
  }

  void _toggleBlankRemote() {
    if (_webrtcService.isAdmin) {
      setState(() {
        _isRemoteBlank = !_isRemoteBlank;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isRemoteBlank ? 'Remote video di-blank' : 'Remote video ditampilkan'),
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  void _showVideoQualityDialog() {
    if (!_webrtcService.isAdmin) return;

    showDialog(
      context: context,
      builder: (context) => _VideoQualityDialog(
        onApply: _adminChangeVideoQuality,
      ),
    );
  }

  void _adminChangeVideoQuality({
    required String resolution,
    required int width,
    required int height,
    required int maxBitrate,
    required int maxFramerate,
  }) {
    _webrtcService.adminChangeVideoQuality(
      resolution: resolution,
      width: width,
      height: height,
      maxBitrate: maxBitrate,
      maxFramerate: maxFramerate,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Menerapkan $resolution (${width}x$height, ${maxBitrate}kbps, ${maxFramerate}fps)'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _startStatsCollection() {
    _statsTimer?.cancel();
    _statsTimer = Timer.periodic(const Duration(seconds: 1), (timer) async {
      if (!_isConnected) {
        timer.cancel();
        return;
      }
      
      final stats = await _webrtcService.getStats();
      if (stats != null && mounted) {
        setState(() {
          _stats = stats;
        });
      }
    });
  }

  void _stopStatsCollection() {
    _statsTimer?.cancel();
    _statsTimer = null;
  }

  void _toggleStats() {
    setState(() {
      _showStats = !_showStats;
    });
  }

  void _resetControlsTimer() {
    _controlsTimer?.cancel();
    
    if (!_showControls) {
      setState(() {
        _showControls = true;
      });
    }
    
    // Auto-hide controls after 3 seconds
    _controlsTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() {
          _showControls = false;
        });
      }
    });
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
          _resetControlsTimer();
        },
        child: Stack(
          children: [
            // Remote Video (Fullscreen)
            SizedBox.expand(
              child: Stack(
                children: [
                  // Video layer
                  _remoteRenderer.srcObject != null &&
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
                  
                  // Blank overlay (Admin only)
                  if (_isRemoteBlank && _webrtcService.isAdmin)
                    Container(
                      color: Colors.black,
                      child: const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.visibility_off,
                              size: 64,
                              color: Colors.white54,
                            ),
                            SizedBox(height: 16),
                            Text(
                              'Remote video di-blank',
                              style: TextStyle(
                                color: Colors.white54,
                                fontSize: 16,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  
                  // Remote media status indicators
                  if (_isConnected)
                    Positioned(
                      top: 16,
                      left: 16,
                      child: Row(
                        children: [
                          // Remote camera status
                          if (!_isRemoteCameraEnabled)
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.black.withOpacity(0.6),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.videocam_off,
                                    color: Colors.red,
                                    size: 20,
                                  ),
                                  SizedBox(width: 4),
                                  Text(
                                    'Kamera Off',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          const SizedBox(width: 8),
                          // Remote mic status
                          if (_isRemoteMuted)
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.black.withOpacity(0.6),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.mic_off,
                                    color: Colors.red,
                                    size: 20,
                                  ),
                                  SizedBox(width: 4),
                                  Text(
                                    'Muted',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
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
                      // Always render video but overlay if visual off
                      RTCVideoView(
                        _localRenderer,
                        objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                        mirror: true,
                      ),
                      // Visual overlay (camera actually on but hidden)
                      if (_isCameraVisuallyOff)
                        Container(
                          color: Colors.black,
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
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Anda',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              if (!_isMicEnabled)
                                const Icon(
                                  Icons.mic_off,
                                  color: Colors.red,
                                  size: 12,
                                ),
                            ],
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
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Admin controls (if admin)
                      if (_webrtcService.isAdmin && _isConnected)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _buildSmallControlButton(
                                icon: Icons.videocam_off,
                                label: 'Toggle User Cam',
                                onPressed: _adminToggleUserCamera,
                              ),
                              const SizedBox(width: 8),
                              _buildSmallControlButton(
                                icon: Icons.flip_camera_ios,
                                label: 'Switch User Cam',
                                onPressed: _adminSwitchUserCamera,
                              ),
                              const SizedBox(width: 8),
                              _buildSmallControlButton(
                                icon: Icons.high_quality,
                                label: 'Video Quality',
                                onPressed: _showVideoQualityDialog,
                              ),
                              const SizedBox(width: 8),
                              _buildSmallControlButton(
                                icon: _isRemoteBlank ? Icons.visibility : Icons.visibility_off,
                                label: 'Blank',
                                onPressed: _toggleBlankRemote,
                                backgroundColor: _isRemoteBlank
                                    ? AppTheme.primaryGreen
                                    : AppTheme.darkBgTertiary,
                              ),
                            ],
                          ),
                        ),
                      
                      // Main controls
                      Row(
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
                            icon: !_isCameraVisuallyOff ? Icons.videocam : Icons.videocam_off,
                            onPressed: _toggleCamera,
                            backgroundColor: !_isCameraVisuallyOff
                                ? AppTheme.darkBgTertiary
                                : AppTheme.errorColor,
                          ),
                          
                          // Switch camera
                          _buildControlButton(
                            icon: Icons.flip_camera_ios,
                            onPressed: _switchCamera,
                            backgroundColor: AppTheme.darkBgTertiary,
                          ),
                          
                          // Stats toggle
                          _buildControlButton(
                            icon: Icons.analytics_outlined,
                            onPressed: _toggleStats,
                            backgroundColor: _showStats
                                ? AppTheme.primaryGreen
                                : AppTheme.darkBgTertiary,
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
                    ],
                  ),
                ),
              ),

            // Stats Panel
            if (_showStats && _isConnected)
              Positioned(
                bottom: MediaQuery.of(context).padding.bottom + 100,
                left: 16,
                right: 16,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.8),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppTheme.primaryGreen.withOpacity(0.3),
                      width: 1,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Row(
                        children: [
                          Icon(
                            Icons.analytics,
                            color: AppTheme.primaryGreen,
                            size: 20,
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Statistik Koneksi',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _buildStatRow('Bitrate', '${_stats['bitrate']} kbps'),
                      _buildStatRow('Packet Loss', '${_stats['packetLoss']}%'),
                      _buildStatRow('RTT', _stats['rtt']),
                      _buildStatRow('Resolution', _stats['resolution']),
                      _buildStatRow('FPS', '${_stats['fps']}'),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withOpacity(0.7),
              fontSize: 14,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSmallControlButton({
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
    Color? backgroundColor,
  }) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: backgroundColor ?? AppTheme.darkBgTertiary,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: AppTheme.primaryGreen.withOpacity(0.3),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Colors.white, size: 16),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w600,
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

// Video Quality Dialog Widget
class _VideoQualityDialog extends StatefulWidget {
  final Function({
    required String resolution,
    required int width,
    required int height,
    required int maxBitrate,
    required int maxFramerate,
  }) onApply;

  const _VideoQualityDialog({required this.onApply});

  @override
  State<_VideoQualityDialog> createState() => _VideoQualityDialogState();
}

class _VideoQualityDialogState extends State<_VideoQualityDialog> {
  String _selectedPreset = '720p';
  int _customWidth = 1280;
  int _customHeight = 720;
  int _maxBitrate = 1500;
  int _maxFramerate = 30;

  final Map<String, Map<String, int>> _presets = {
    '360p': {'width': 640, 'height': 360, 'bitrate': 500, 'fps': 24},
    '480p': {'width': 854, 'height': 480, 'bitrate': 800, 'fps': 30},
    '720p': {'width': 1280, 'height': 720, 'bitrate': 1500, 'fps': 30},
    '1080p': {'width': 1920, 'height': 1080, 'bitrate': 3000, 'fps': 30},
  };

  @override
  void initState() {
    super.initState();
    _applyPreset(_selectedPreset);
  }

  void _applyPreset(String preset) {
    final values = _presets[preset]!;
    setState(() {
      _selectedPreset = preset;
      _customWidth = values['width']!;
      _customHeight = values['height']!;
      _maxBitrate = values['bitrate']!;
      _maxFramerate = values['fps']!;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppTheme.darkBgSecondary,
      title: const Text(
        'Video Quality Settings',
        style: TextStyle(color: Colors.white),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Preset Dropdown
            const Text(
              'Preset',
              style: TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: AppTheme.darkBgTertiary,
                borderRadius: BorderRadius.circular(8),
              ),
              child: DropdownButton<String>(
                value: _selectedPreset,
                isExpanded: true,
                dropdownColor: AppTheme.darkBgTertiary,
                style: const TextStyle(color: Colors.white),
                underline: const SizedBox(),
                items: _presets.keys.map((key) {
                  final preset = _presets[key]!;
                  return DropdownMenuItem(
                    value: key,
                    child: Text('$key (${preset['width']}x${preset['height']})'),
                  );
                }).toList(),
                onChanged: (value) {
                  if (value != null) _applyPreset(value);
                },
              ),
            ),
            const SizedBox(height: 16),

            // Resolution
            Text(
              'Resolution: ${_customWidth}x$_customHeight',
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 16),

            // Max Bitrate
            Text(
              'Max Bitrate: ${_maxBitrate} kbps',
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
            Slider(
              value: _maxBitrate.toDouble(),
              min: 300,
              max: 5000,
              divisions: 47,
              activeColor: AppTheme.primaryGreen,
              inactiveColor: AppTheme.darkBgTertiary,
              onChanged: (value) {
                setState(() {
                  _maxBitrate = value.toInt();
                });
              },
            ),
            const SizedBox(height: 8),

            // Max Framerate
            Text(
              'Max Framerate: $_maxFramerate fps',
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
            Slider(
              value: _maxFramerate.toDouble(),
              min: 15,
              max: 60,
              divisions: 9,
              activeColor: AppTheme.primaryGreen,
              inactiveColor: AppTheme.darkBgTertiary,
              onChanged: (value) {
                setState(() {
                  _maxFramerate = value.toInt();
                });
              },
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel', style: TextStyle(color: Colors.white70)),
        ),
        ElevatedButton(
          onPressed: () {
            widget.onApply(
              resolution: _selectedPreset,
              width: _customWidth,
              height: _customHeight,
              maxBitrate: _maxBitrate,
              maxFramerate: _maxFramerate,
            );
            Navigator.pop(context);
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.primaryGreen,
          ),
          child: const Text('Apply'),
        ),
      ],
    );
  }
}
