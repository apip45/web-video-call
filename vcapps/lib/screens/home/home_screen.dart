import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/services/api_service.dart';
import '../../core/theme/app_theme.dart';
import '../../models/user.dart';
import '../auth/login_screen.dart';
import '../room/room_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _roomNameController = TextEditingController();
  final _joinRoomIdController = TextEditingController();
  User? _currentUser;
  bool _isLoadingUser = true;
  bool _isCreatingRoom = false;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  @override
  void dispose() {
    _roomNameController.dispose();
    _joinRoomIdController.dispose();
    super.dispose();
  }

  Future<void> _loadUser() async {
    try {
      final userData = await ApiService.getUser();
      if (userData != null) {
        setState(() {
          _currentUser = User.fromJson(userData);
          _isLoadingUser = false;
        });
      } else {
        _logout();
      }
    } catch (e) {
      _logout();
    }
  }

  Future<void> _logout() async {
    await ApiService.clearToken();
    await ApiService.clearUser();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  Future<void> _createRoom() async {
    setState(() => _isCreatingRoom = true);

    try {
      final result = await ApiService.createRoom(
        _roomNameController.text.trim().isEmpty
            ? null
            : _roomNameController.text.trim(),
      );

      if (mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => RoomScreen(
              roomId: result['room']['roomId'],
              roomName: result['room']['name'],
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isCreatingRoom = false);
      }
    }
  }

  void _joinRoom() {
    final roomId = _joinRoomIdController.text.trim();
    if (roomId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Masukkan Room ID'),
          backgroundColor: AppTheme.errorColor,
        ),
      );
      return;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RoomScreen(roomId: roomId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingUser) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppTheme.darkBgSecondary
                    : AppTheme.lightBgSecondary,
                border: Border(
                  bottom: BorderSide(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppTheme.darkBorder
                        : AppTheme.lightBorder,
                  ),
                ),
              ),
              child: Row(
                children: [
                  // Logo
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppTheme.primaryGreen.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.videocam,
                      color: AppTheme.primaryGreen,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'Video Call',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  // User info
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _currentUser?.displayName ?? _currentUser?.username ?? '',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      if (_currentUser?.role == 'admin')
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppTheme.primaryGreen.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'Admin',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.primaryGreen,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 12),
                  IconButton(
                    icon: const Icon(Icons.logout),
                    onPressed: _logout,
                    tooltip: 'Logout',
                  ),
                ],
              ),
            ),
            
            // Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 600),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Title
                      const Text(
                        'Mulai Video Call',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 24),
                      
                      // Create Room Card
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              TextField(
                                controller: _roomNameController,
                                decoration: const InputDecoration(
                                  hintText: 'Nama room (opsional)',
                                  prefixIcon: Icon(Icons.meeting_room),
                                ),
                                enabled: !_isCreatingRoom,
                                maxLength: 50,
                              ),
                              const SizedBox(height: 16),
                              SizedBox(
                                height: 50,
                                child: ElevatedButton(
                                  onPressed: _isCreatingRoom ? null : _createRoom,
                                  child: _isCreatingRoom
                                      ? const SizedBox(
                                          width: 24,
                                          height: 24,
                                          child: CircularProgressIndicator(
                                            color: Colors.white,
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : Row(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            const Icon(Icons.videocam, size: 20),
                                            const SizedBox(width: 8),
                                            const Text('Buat Room Baru'),
                                          ],
                                        ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      
                      // Divider
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: Row(
                          children: [
                            const Expanded(child: Divider()),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: Text(
                                'atau',
                                style: TextStyle(
                                  color: Theme.of(context).brightness == Brightness.dark
                                      ? AppTheme.darkTextMuted
                                      : AppTheme.lightTextMuted,
                                ),
                              ),
                            ),
                            const Expanded(child: Divider()),
                          ],
                        ),
                      ),
                      
                      // Join Room Card
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              TextField(
                                controller: _joinRoomIdController,
                                decoration: const InputDecoration(
                                  hintText: 'Masukkan Room ID',
                                  prefixIcon: Icon(Icons.tag),
                                ),
                                textInputAction: TextInputAction.go,
                                onSubmitted: (_) => _joinRoom(),
                              ),
                              const SizedBox(height: 16),
                              SizedBox(
                                height: 50,
                                child: ElevatedButton(
                                  onPressed: _joinRoom,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Theme.of(context).brightness ==
                                            Brightness.dark
                                        ? AppTheme.darkBgTertiary
                                        : AppTheme.lightBgTertiary,
                                    foregroundColor: Theme.of(context).brightness ==
                                            Brightness.dark
                                        ? AppTheme.darkTextPrimary
                                        : AppTheme.lightTextPrimary,
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(Icons.login, size: 20),
                                      const SizedBox(width: 8),
                                      const Text('Join Room'),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      
                      const SizedBox(height: 24),
                      
                      // Info card
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppTheme.infoColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppTheme.infoColor.withOpacity(0.3),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.info_outline,
                              color: AppTheme.infoColor,
                              size: 20,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Bagikan Room ID kepada orang lain untuk bergabung ke video call Anda',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Theme.of(context).brightness ==
                                          Brightness.dark
                                      ? AppTheme.darkTextSecondary
                                      : AppTheme.lightTextSecondary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
