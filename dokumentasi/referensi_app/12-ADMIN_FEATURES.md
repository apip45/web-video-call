# 👨‍💼 Admin Features & Control Panel

## Implementasi Admin Dashboard dan Fitur Kontrol Ruangan

---

## 📋 Admin Data Models

### **Admin Model**

```dart
class AdminUser {
  final String id;
  final String email;
  final String name;
  final AdminRole role;
  final DateTime createdAt;
  final bool isApproved;
  
  AdminUser({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.createdAt,
    this.isApproved = false,
  });
  
  factory AdminUser.fromJson(Map<String, dynamic> json) {
    return AdminUser(
      id: json['_id'],
      email: json['email'],
      name: json['name'],
      role: AdminRole.values.firstWhere(
        (e) => e.toString().split('.').last == json['role']
      ),
      createdAt: DateTime.parse(json['createdAt']),
      isApproved: json['isApproved'] ?? false,
    );
  }
}

enum AdminRole {
  superAdmin,
  moderator,
  viewer,
}
```

---

### **Room Control Model**

```dart
class RoomControl {
  final String roomId;
  final List<ParticipantControl> participants;
  final RoomSettings settings;
  final bool recordingEnabled;
  final DateTime controlChangedAt;
  
  RoomControl({
    required this.roomId,
    required this.participants,
    required this.settings,
    this.recordingEnabled = false,
    required this.controlChangedAt,
  });
}

class ParticipantControl {
  final String userId;
  final String userName;
  bool cameraAllowed;
  bool audioAllowed;
  bool screenShareAllowed;
  bool chatAllowed;
  bool canPresent;
  DateTime lastControlChange;
  
  ParticipantControl({
    required this.userId,
    required this.userName,
    this.cameraAllowed = true,
    this.audioAllowed = true,
    this.screenShareAllowed = true,
    this.chatAllowed = true,
    this.canPresent = false,
    required this.lastControlChange,
  });
}

class RoomSettings {
  bool allowCamera;
  bool allowAudio;
  bool allowScreenShare;
  bool allowChat;
  bool loteryEnabled;
  int maxParticipants;
  
  RoomSettings({
    this.allowCamera = true,
    this.allowAudio = true,
    this.allowScreenShare = true,
    this.allowChat = true,
    this.loteryEnabled = false,
    this.maxParticipants = 100,
  });
}
```

---

## 🎛️ Admin Service

### **Admin API Service**

```dart
class AdminService {
  final DioClient dioClient;
  
  AdminService({required this.dioClient});
  
  // Get all rooms statistics
  Future<List<RoomStats>> getAllRoomsStats() async {
    try {
      final response = await dioClient.get('/admin/rooms-stats');
      return (response as List)
        .map((e) => RoomStats.fromJson(e))
        .toList();
    } catch (e) {
      throw AdminServiceException('Failed to fetch rooms stats: $e');
    }
  }
  
  // Get room details
  Future<RoomDetails> getRoomDetails(String roomId) async {
    try {
      final response = await dioClient.get('/admin/rooms/$roomId');
      return RoomDetails.fromJson(response);
    } catch (e) {
      throw AdminServiceException('Failed to fetch room details: $e');
    }
  }
  
  // Get participants in room
  Future<List<ParticipantInfo>> getRoomParticipants(String roomId) async {
    try {
      final response = await dioClient.get('/admin/rooms/$roomId/participants');
      return (response as List)
        .map((e) => ParticipantInfo.fromJson(e))
        .toList();
    } catch (e) {
      throw AdminServiceException('Failed to fetch participants: $e');
    }
  }
  
  // Update room settings
  Future<void> updateRoomSettings(String roomId, RoomSettings settings) async {
    try {
      await dioClient.put(
        '/admin/rooms/$roomId/settings',
        data: {
          'allowCamera': settings.allowCamera,
          'allowAudio': settings.allowAudio,
          'allowScreenShare': settings.allowScreenShare,
          'allowChat': settings.allowChat,
          'maxParticipants': settings.maxParticipants,
        },
      );
    } catch (e) {
      throw AdminServiceException('Failed to update room settings: $e');
    }
  }
  
  // Control participant features
  Future<void> controlParticipant(
    String roomId,
    String userId,
    ParticipantControl control,
  ) async {
    try {
      await dioClient.post(
        '/admin/rooms/$roomId/participants/$userId/control',
        data: {
          'cameraAllowed': control.cameraAllowed,
          'audioAllowed': control.audioAllowed,
          'screenShareAllowed': control.screenShareAllowed,
          'chatAllowed': control.chatAllowed,
          'canPresent': control.canPresent,
        },
      );
    } catch (e) {
      throw AdminServiceException('Failed to control participant: $e');
    }
  }
  
  // Kick participant from room
  Future<void> kickParticipant(String roomId, String userId) async {
    try {
      await dioClient.post(
        '/admin/rooms/$roomId/participants/$userId/kick',
      );
    } catch (e) {
      throw AdminServiceException('Failed to kick participant: $e');
    }
  }
  
  // Mute all audio
  Future<void> muteAllAudio(String roomId) async {
    try {
      await dioClient.post('/admin/rooms/$roomId/mute-all-audio');
    } catch (e) {
      throw AdminServiceException('Failed to mute all audio: $e');
    }
  }
  
  // Stop all video
  Future<void> stopAllVideo(String roomId) async {
    try {
      await dioClient.post('/admin/rooms/$roomId/stop-all-video');
    } catch (e) {
      throw AdminServiceException('Failed to stop all video: $e');
    }
  }
  
  // Lock room
  Future<void> lockRoom(String roomId) async {
    try {
      await dioClient.post('/admin/rooms/$roomId/lock');
    } catch (e) {
      throw AdminServiceException('Failed to lock room: $e');
    }
  }
  
  // Unlock room
  Future<void> unlockRoom(String roomId) async {
    try {
      await dioClient.post('/admin/rooms/$roomId/unlock');
    } catch (e) {
      throw AdminServiceException('Failed to unlock room: $e');
    }
  }
  
  // Get admin statistics
  Future<AdminStats> getAdminStats() async {
    try {
      final response = await dioClient.get('/admin/stats');
      return AdminStats.fromJson(response);
    } catch (e) {
      throw AdminServiceException('Failed to fetch admin stats: $e');
    }
  }
}
```

---

## 🔌 Admin Socket Handler

### **Socket.IO Admin Events**

```dart
class AdminSocketHandler {
  final SocketService socketService;
  StreamController<AdminEvent> adminEventController = 
    StreamController<AdminEvent>.broadcast();
  
  AdminSocketHandler({required this.socketService});
  
  void setupListeners() {
    // Listen for admin commands
    socketService.on('admin:disableCamera', (data) {
      handleDisableCamera(data);
    });
    
    socketService.on('admin:enableCamera', (data) {
      handleEnableCamera(data);
    });
    
    socketService.on('admin:muteAudio', (data) {
      handleMuteAudio(data);
    });
    
    socketService.on('admin:unmuteAudio', (data) {
      handleUnmuteAudio(data);
    });
    
    socketService.on('admin:kickUser', (data) {
      handleKickUser(data);
    });
    
    socketService.on('admin:lockRoom', (data) {
      handleLockRoom(data);
    });
    
    socketService.on('admin:recordingStart', (data) {
      handleRecordingStart(data);
    });
    
    socketService.on('admin:recordingStop', (data) {
      handleRecordingStop(data);
    });
  }
  
  void handleDisableCamera(Map<String, dynamic> data) {
    String userId = data['userId'];
    adminEventController.add(AdminEvent(
      type: AdminEventType.cameraDisabled,
      userId: userId,
      timestamp: DateTime.now(),
    ));
  }
  
  void handleEnableCamera(Map<String, dynamic> data) {
    String userId = data['userId'];
    adminEventController.add(AdminEvent(
      type: AdminEventType.cameraEnabled,
      userId: userId,
      timestamp: DateTime.now(),
    ));
  }
  
  void handleMuteAudio(Map<String, dynamic> data) {
    String userId = data['userId'];
    adminEventController.add(AdminEvent(
      type: AdminEventType.audioMuted,
      userId: userId,
      timestamp: DateTime.now(),
    ));
  }
  
  void handleUnmuteAudio(Map<String, dynamic> data) {
    String userId = data['userId'];
    adminEventController.add(AdminEvent(
      type: AdminEventType.audioUnmuted,
      userId: userId,
      timestamp: DateTime.now(),
    ));
  }
  
  void handleKickUser(Map<String, dynamic> data) {
    String userId = data['userId'];
    adminEventController.add(AdminEvent(
      type: AdminEventType.userKicked,
      userId: userId,
      timestamp: DateTime.now(),
    ));
  }
  
  void handleLockRoom(Map<String, dynamic> data) {
    adminEventController.add(AdminEvent(
      type: AdminEventType.roomLocked,
      timestamp: DateTime.now(),
    ));
  }
  
  void handleRecordingStart(Map<String, dynamic> data) {
    adminEventController.add(AdminEvent(
      type: AdminEventType.recordingStarted,
      timestamp: DateTime.now(),
    ));
  }
  
  void handleRecordingStop(Map<String, dynamic> data) {
    adminEventController.add(AdminEvent(
      type: AdminEventType.recordingStopped,
      timestamp: DateTime.now(),
    ));
  }
  
  void dispose() {
    adminEventController.close();
  }
}

class AdminEvent {
  final AdminEventType type;
  final String? userId;
  final DateTime timestamp;
  
  AdminEvent({
    required this.type,
    this.userId,
    required this.timestamp,
  });
}

enum AdminEventType {
  cameraDisabled,
  cameraEnabled,
  audioMuted,
  audioUnmuted,
  userKicked,
  roomLocked,
  roomUnlocked,
  recordingStarted,
  recordingStopped,
}
```

---

## 🎨 Admin Provider

### **Admin Control Provider**

```dart
class AdminProvider extends ChangeNotifier {
  final AdminService adminService;
  final AdminSocketHandler socketHandler;
  
  List<RoomStats>? _roomsStats;
  RoomDetails? _currentRoomDetails;
  List<ParticipantInfo>? _participants;
  AdminStats? _adminStats;
  bool _isLoading = false;
  String? _error;
  
  AdminProvider({
    required this.adminService,
    required this.socketHandler,
  }) {
    socketHandler.setupListeners();
  }
  
  // Getters
  List<RoomStats>? get roomsStats => _roomsStats;
  RoomDetails? get currentRoomDetails => _currentRoomDetails;
  List<ParticipantInfo>? get participants => _participants;
  AdminStats? get adminStats => _adminStats;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAdmin => true; // From auth provider
  
  // Load all rooms statistics
  Future<void> loadRoomsStats() async {
    _isLoading = true;
    notifyListeners();
    
    try {
      _roomsStats = await adminService.getAllRoomsStats();
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Load specific room details
  Future<void> loadRoomDetails(String roomId) async {
    _isLoading = true;
    notifyListeners();
    
    try {
      _currentRoomDetails = await adminService.getRoomDetails(roomId);
      _participants = await adminService.getRoomParticipants(roomId);
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Disable camera for participant
  Future<void> disableCamera(String roomId, String userId) async {
    try {
      var control = _participants!
        .firstWhere((p) => p.userId == userId);
      control.cameraAllowed = false;
      
      await adminService.controlParticipant(roomId, userId, control);
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }
  
  // Enable camera for participant
  Future<void> enableCamera(String roomId, String userId) async {
    try {
      var control = _participants!
        .firstWhere((p) => p.userId == userId);
      control.cameraAllowed = true;
      
      await adminService.controlParticipant(roomId, userId, control);
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }
  
  // Kick participant from room
  Future<void> kickParticipant(String roomId, String userId) async {
    try {
      await adminService.kickParticipant(roomId, userId);
      _participants!.removeWhere((p) => p.userId == userId);
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }
  
  // Mute all audio
  Future<void> muteAllAudio(String roomId) async {
    try {
      await adminService.muteAllAudio(roomId);
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }
  
  // Lock room
  Future<void> lockRoom(String roomId) async {
    try {
      await adminService.lockRoom(roomId);
      if (_currentRoomDetails != null) {
        _currentRoomDetails!.isLocked = true;
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }
  
  @override
  void dispose() {
    socketHandler.dispose();
    super.dispose();
  }
}
```

---

## 🖼️ Admin Dashboard UI

### **Main Admin Screen**

```dart
class AdminDashboardScreen extends Stateful {
  @override
  Widget build(BuildContext context) {
    return Consumer<AdminProvider>(
      builder: (context, adminProvider, _) {
        if (adminProvider.isLoading) {
          return Scaffold(
            appBar: AppBar(title: Text('Admin Dashboard')),
            body: Center(child: CircularProgressIndicator()),
          );
        }
        
        return Scaffold(
          appBar: AppBar(
            title: Text('Admin Dashboard'),
            actions: [
              IconButton(
                icon: Icon(Icons.refresh),
                onPressed: () => adminProvider.loadRoomsStats(),
              ),
            ],
          ),
          body: ListView(
            padding: EdgeInsets.all(16),
            children: [
              // Statistics cards
              _buildStatsCards(adminProvider),
              SizedBox(height: 24),
              
              // Rooms list
              Text(
                'Active Rooms',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              SizedBox(height: 12),
              _buildRoomsList(adminProvider, context),
            ],
          ),
        );
      },
    );
  }
  
  Widget _buildStatsCards(AdminProvider provider) {
    final stats = provider.adminStats;
    if (stats == null) return SizedBox.shrink();
    
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _StatCard(
          title: 'Total Rooms',
          value: stats.totalRooms.toString(),
          icon: Icons.meeting_room,
        ),
        _StatCard(
          title: 'Active Users',
          value: stats.activeUsers.toString(),
          icon: Icons.people,
        ),
        _StatCard(
          title: 'Ongoing Calls',
          value: stats.ongoingCalls.toString(),
          icon: Icons.call,
        ),
      ],
    );
  }
  
  Widget _buildRoomsList(AdminProvider provider, BuildContext context) {
    return ListView.builder(
      shrinkWrap: true,
      itemCount: provider.roomsStats?.length ?? 0,
      itemBuilder: (context, index) {
        final room = provider.roomsStats![index];
        
        return ListTile(
          title: Text(room.name),
          subtitle: Text('${room.participantCount} participants'),
          trailing: PopupMenuButton(
            itemBuilder: (context) => [
              PopupMenuItem(
                child: Text('View Details'),
                onTap: () {
                  provider.loadRoomDetails(room.roomId);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => RoomDetailScreen(roomId: room.roomId),
                    ),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, size: 32, color: Colors.blue),
        SizedBox(height: 8),
        Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
        SizedBox(height: 4),
        Text(title, style: TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }
}
```

---

### **Room Detail Screen with Participant Controls**

```dart
class RoomDetailScreen extends StatefulWidget {
  final String roomId;
  
  @override
  _RoomDetailScreenState createState() => _RoomDetailScreenState();
}

class _RoomDetailScreenState extends State<RoomDetailScreen> {
  @override
  Widget build(BuildContext context) {
    return Consumer<AdminProvider>(
      builder: (context, adminProvider, _) {
        if (adminProvider.currentRoomDetails == null) {
          return Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        
        final room = adminProvider.currentRoomDetails!;
        
        return Scaffold(
          appBar: AppBar(title: Text(room.name)),
          body: ListView(
            padding: EdgeInsets.all(16),
            children: [
              // Room controls
              _buildRoomControls(context, adminProvider, room),
              SizedBox(height: 24),
              
              // Participants list
              Text('Participants', style: Theme.of(context).textTheme.headlineSmall),
              SizedBox(height: 12),
              _buildParticipantsList(context, adminProvider),
            ],
          ),
        );
      },
    );
  }
  
  Widget _buildRoomControls(BuildContext context, AdminProvider provider, RoomDetails room) {
    return Column(
      children: [
        ListTile(
          title: Text('Room Locked'),
          trailing: Switch(
            value: room.isLocked,
            onChanged: (value) {
              if (value) {
                provider.lockRoom(widget.roomId);
              } else {
                // unlockRoom
              }
            },
          ),
        ),
        ListTile(
          title: Text('Mute All Audio'),
          trailing: IconButton(
            icon: Icon(Icons.volume_mute),
            onPressed: () {
              provider.muteAllAudio(widget.roomId);
            },
          ),
        ),
      ],
    );
  }
  
  Widget _buildParticipantsList(BuildContext context, AdminProvider provider) {
    return ListView.builder(
      shrinkWrap: true,
      itemCount: provider.participants?.length ?? 0,
      itemBuilder: (context, index) {
        final participant = provider.participants![index];
        
        return Card(
          child: ListTile(
            title: Text(participant.userName),
            subtitle: Text(participant.email),
            trailing: PopupMenuButton(
              itemBuilder: (context) => [
                PopupMenuItem(
                  child: Text(participant.cameraAllowed ? 'Disable Camera' : 'Enable Camera'),
                  onTap: () {
                    if (participant.cameraAllowed) {
                      provider.disableCamera(widget.roomId, participant.userId);
                    } else {
                      provider.enableCamera(widget.roomId, participant.userId);
                    }
                  },
                ),
                PopupMenuItem(
                  child: Text('Kick'),
                  onTap: () {
                    provider.kickParticipant(widget.roomId, participant.userId);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
```

---

## 📊 Admin Reports

### **Generate Reports**

```dart
class AdminReportService {
  final DioClient dioClient;
  
  // Generate usage report
  Future<UsageReport> generateUsageReport({
    required DateTime startDate,
    required DateTime endDate,
  }) async {
    final response = await dioClient.get(
      '/admin/reports/usage',
      queryParameters: {
        'startDate': startDate.toIso8601String(),
        'endDate': endDate.toIso8601String(),
      },
    );
    return UsageReport.fromJson(response);
  }
  
  // Export usage report as PDF
  Future<void> exportReportPDF(UsageReport report) async {
    final response = await dioClient.get('/admin/reports/export-pdf');
    // Download PDF
  }
}
```

---

**Last Updated**: March 17, 2025
**Difficulty Level**: Advanced
**Estimated Implementation Time**: 3-4 days

