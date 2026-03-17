# 🎨 UI Screens Design - Screen Layout & Navigation

## UI/UX Design untuk Flutter App

Panduan lengkap untuk screen design, navigation flow, dan UI components.

---

## 🗂️ Navigation Structure

### **Route Definition**

File: `lib/shared/navigation/routes.dart`

```dart
class Routes {
  static const String splash = '/';
  static const String login = '/login';
  static const String register = '/register';
  static const String home = '/home';
  static const String room = '/room/:roomId';
  static const String admin = '/admin';
  static const String profile = '/profile';
  static const String settings = '/settings';
}
```

### **GoRouter Setup**

File: `lib/shared/navigation/app_router.dart`

```dart
import 'package:go_router/go_router.dart';

class AppRouter {
  static final GoRouter router = GoRouter(
    initialLocation: Routes.splash,
    redirect: (context, state) async {
      // Check authentication
      final authProvider = Provider.of<AuthProvider>(
        context,
        listen: false,
      );
      
      final isLoggedIn = authProvider.isAuthenticated;
      final isLoggingIn = state.path == Routes.login ||
          state.path == Routes.register;
      
      // Redirect logic
      if (!isLoggedIn && !isLoggingIn) {
        return Routes.login;
      }
      
      if (isLoggedIn && isLoggingIn) {
        return Routes.home;
      }
      
      return null;
    },
    routes: [
      // Splash
      GoRoute(
        path: Routes.splash,
        builder: (context, state) => SplashPage(),
      ),
      
      // Auth routes
      GoRoute(
        path: Routes.login,
        builder: (context, state) => LoginPage(),
      ),
      
      GoRoute(
        path: Routes.register,
        builder: (context, state) => RegisterPage(),
      ),
      
      // Main routes
      GoRoute(
        path: Routes.home,
        builder: (context, state) => HomePage(),
      ),
      
      GoRoute(
        path: Routes.room,
        builder: (context, state) {
          final roomId = state.pathParameters['roomId']!;
          return RoomPage(roomId: roomId);
        },
      ),
      
      GoRoute(
        path: Routes.admin,
        builder: (context, state) => AdminPage(),
      ),
      
      GoRoute(
        path: Routes.profile,
        builder: (context, state) => ProfilePage(),
      ),
    ],
  );
}
```

---

## 📱 Screen Designs

### **1. Splash Screen**

```dart
class SplashPage extends StatefulWidget {
  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    _initializeApp();
  }
  
  Future<void> _initializeApp() async {
    await Future.delayed(Duration(seconds: 2));
    
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final currentUser = await authProvider.getCurrentUser();
    
    if (currentUser != null) {
      context.go(Routes.home);
    } else {
      context.go(Routes.login);
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Logo
            Image.asset(
              'assets/images/logo.png',
              width: 100,
              height: 100,
            ),
            SizedBox(height: 20),
            
            // App name
            Text(
              'WebRTC Call',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            SizedBox(height: 40),
            
            // Loading indicator
            CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
```

### **2. Login Screen**

```dart
class LoginPage extends StatefulWidget {
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  late TextEditingController _emailController;
  late TextEditingController _passwordController;
  bool _obscurePassword = true;
  
  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController();
    _passwordController = TextEditingController();
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Login')),
      body: Consumer<AuthProvider>(
        builder: (context, authProvider, _) {
          return SingleChildScrollView(
            padding: EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(height: 40),
                
                // Header
                Center(
                  child: Column(
                    children: [
                      Image.asset(
                        'assets/images/logo.png',
                        width: 80,
                        height: 80,
                      ),
                      SizedBox(height: 20),
                      Text(
                        'Welcome Back',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                    ],
                  ),
                ),
                
                SizedBox(height: 40),
                
                // Email field
                TextField(
                  controller: _emailController,
                  decoration: InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.email),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  keyboardType: TextInputType.emailAddress,
                ),
                
                SizedBox(height: 16),
                
                // Password field
                TextField(
                  controller: _passwordController,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    prefixIcon: Icon(Icons.lock),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off
                            : Icons.visibility,
                      ),
                      onPressed: () {
                        setState(() {
                          _obscurePassword = !_obscurePassword;
                        });
                      },
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  obscureText: _obscurePassword,
                ),
                
                SizedBox(height: 24),
                
                // Error message
                if (authProvider.error != null)
                  Padding(
                    padding: EdgeInsets.only(bottom: 16),
                    child: Text(
                      authProvider.error!,
                      style: TextStyle(color: Colors.red),
                      textAlign: TextAlign.center,
                    ),
                  ),
                
                // Login button
                ElevatedButton(
                  onPressed: authProvider.isLoading
                      ? null
                      : () {
                          final email = _emailController.text;
                          final password = _passwordController.text;
                          
                          authProvider.login(email, password);
                          
                          if (authProvider.isAuthenticated) {
                            context.go(Routes.home);
                          }
                        },
                  child: authProvider.isLoading
                      ? SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                          ),
                        )
                      : Text('Login'),
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
                
                SizedBox(height: 16),
                
                // Register link
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Don\\'t have an account? '),
                    TextButton(
                      onPressed: () => context.go(Routes.register),
                      child: Text('Register'),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
  
  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}
```

### **3. Home Screen (Rooms List)**

```dart
class HomePage extends StatefulWidget {
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<RoomProvider>(context, listen: false).fetchRooms();
    });
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Rooms'),
        actions: [
          IconButton(
            icon: Icon(Icons.person),
            onPressed: () => context.go(Routes.profile),
          ),
        ],
      ),
      body: Consumer<RoomProvider>(
        builder: (context, roomProvider, _) {
          if (roomProvider.isLoading) {
            return Center(child: CircularProgressIndicator());
          }
          
          if (roomProvider.rooms.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.video_call, size: 80, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('No rooms available'),
                ],
              ),
            );
          }
          
          return ListView.builder(
            padding: EdgeInsets.all(8),
            itemCount: roomProvider.rooms.length,
            itemBuilder: (context, index) {
              final room = roomProvider.rooms[index];
              return RoomCard(
                room: room,
                onJoin: () {
                  context.go('${Routes.room}/${room.id}');
                },
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreateRoomDialog(context),
        child: Icon(Icons.add),
      ),
    );
  }
  
  void _showCreateRoomDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Create Room'),
        content: TextField(
          decoration: InputDecoration(hintText: 'Room name'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              // Create room logic
              Navigator.pop(context);
            },
            child: Text('Create'),
          ),
        ],
      ),
    );
  }
}

// Room card widget
class RoomCard extends StatelessWidget {
  final RoomEntity room;
  final VoidCallback onJoin;
  
  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.symmetric(vertical: 8),
      child: ListTile(
        title: Text(room.name),
        subtitle: Text('${room.participantCount} participants'),
        trailing: ElevatedButton(
          onPressed: onJoin,
          child: Text('Join'),
        ),
      ),
    );
  }
}
```

### **4. Video Call Screen**

```dart
class RoomPage extends StatefulWidget {
  final String roomId;
  
  @override
  State<RoomPage> createState() => _RoomPageState();
}

class _RoomPageState extends State<RoomPage> {
  @override
  void initState() {
    super.initState();
    _initializeCall();
  }
  
  Future<void> _initializeCall() async {
    final mediaProvider = Provider.of<MediaProvider>(context, listen: false);
    final callProvider = Provider.of<CallProvider>(context, listen: false);
    
    await mediaProvider.initMedia();
    await callProvider.joinRoom(widget.roomId);
  }
  
  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async {
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text('End Call?'),
            content: Text('Do you want to end the call?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text('No'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text('Yes, End Call'),
              ),
            ],
          ),
        );
        
        if (confirmed == true) {
          Provider.of<CallProvider>(context, listen: false).leaveRoom();
        }
        
        return confirmed ?? false;
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text('Video Call'),
          actions: [
            IconButton(
              icon: Icon(Icons.info),
              onPressed: () => _showCallInfo(context),
            ),
          ],
        ),
        body: Consumer<MediaProvider>(
          builder: (context, mediaProvider, _) {
            if (mediaProvider.localStream == null) {
              return Center(child: CircularProgressIndicator());
            }
            
            return Stack(
              children: [
                // Main video area
                VideoGrid(
                  localStream: mediaProvider.localStream!,
                  remoteStreams: {}, // Get from provider
                ),
                
                // Stats overlay
                Positioned(
                  top: 16,
                  right: 16,
                  child: Consumer<StatsProvider>(
                    builder: (context, statsProvider, _) {
                      return Container(
                        padding: EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'FPS: ${statsProvider.fps}\\n'
                          'Bitrate: ${statsProvider.bitrate} kbps\\n'
                          'Latency: ${statsProvider.latency} ms',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                          ),
                        ),
                      );
                    },
                  ),
                ),
                
                // Controls at bottom
                Positioned(
                  bottom: 16,
                  left: 16,
                  right: 16,
                  child: CallControlsWidget(),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
  
  void _showCallInfo(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Call Information',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            SizedBox(height: 16),
            Text('Room ID: ${widget.roomId}'),
            Text('Duration: 02:35'),
            // More info
          ],
        ),
      ),
    );
  }
}
```

### **5. Profile Screen**

```dart
class ProfilePage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Profile')),
      body: Consumer<AuthProvider>(
        builder: (context, authProvider, _) {
          final user = authProvider.currentUser;
          
          if (user == null) {
            return Center(child: Text('Not logged in'));
          }
          
          return SingleChildScrollView(
            padding: EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Profile header
                Center(
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 50,
                        child: Text(user.name[0]),
                      ),
                      SizedBox(height: 16),
                      Text(
                        user.name,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      Text(user.email),
                    ],
                  ),
                ),
                
                SizedBox(height: 32),
                
                // Logout button
                ElevatedButton(
                  onPressed: () {
                    authProvider.logout();
                    context.go(Routes.login);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                  ),
                  child: Text('Logout'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
```

---

## 🌍 Theme Setup

File: `lib/shared/theme/app_theme.dart`

```dart
class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: Colors.blue,
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          padding: EdgeInsets.symmetric(horizontal: 32, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
    );
  }
  
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: Colors.blue,
        brightness: Brightness.dark,
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        backgroundColor: Colors.grey[900],
      ),
    );
  }
}
```

---

## 🎯 Main App Setup

File: `lib/main.dart`

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AudioService.initAudio();
  
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider(...)),
        ChangeNotifierProvider(create: (_) => RoomProvider(...)),
        ChangeNotifierProvider(create: (_) => MediaProvider(...)),
        ChangeNotifierProvider(create: (_) => CallProvider(...)),
        ChangeNotifierProvider(create: (_) => StatsProvider(...)),
      ],
      child: MaterialApp.router(
        title: 'WebRTC Video Call',
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.system,
        routerConfig: AppRouter.router,
      ),
    );
  }
}
```

---

## 🚀 Screen Design Checklist

- [ ] Splash screen
- [ ] Login screen
- [ ] Register screen
- [ ] Home screen (rooms list)
- [ ] Room/Call screen
- [ ] Admin panel
- [ ] Profile screen
- [ ] Settings screen
- [ ] Theme setup (light/dark)
- [ ] Navigation routing

---

**Last Updated**: March 17, 2025
**Status**: Complete UI Design
**Framework**: GoRouter + Provider

