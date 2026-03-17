# 🧪 Testing Strategy & Best Practices

## Complete Testing Guide untuk Flutter Video Call App

---

## 📋 Testing Hierarchy

```
Unit Tests (40%)
├── Models & Data Classes
├── Services & Utils
└── Business Logic

Widget Tests (35%)
├── UI Components
├── Screen Layouts
└── Navigation

Integration Tests (20%)
├── User Flows
├── API Integration
└── WebRTC Signaling

E2E Tests (5%)
├── Full User Scenarios
└── Cross-device Testing
```

---

## 🧩 Unit Testing

### **1. Test Models & Data Classes**

```dart
// test/models/user_model_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:your_app/models/user.dart';

void main() {
  group('User Model Tests', () {
    test('Create user from JSON', () {
      final json = {
        '_id': '123',
        'email': 'john@example.com',
        'name': 'John Doe',
        'role': 'user',
        'createdAt': '2025-03-17T10:00:00Z',
      };
      
      final user = User.fromJson(json);
      
      expect(user.id, equals('123'));
      expect(user.email, equals('john@example.com'));
      expect(user.name, equals('John Doe'));
    });
    
    test('Convert user to JSON', () {
      final user = User(
        id: '123',
        email: 'john@example.com',
        name: 'John Doe',
        role: UserRole.user,
        createdAt: DateTime(2025, 3, 17),
      );
      
      final json = user.toJson();
      
      expect(json['_id'], equals('123'));
      expect(json['email'], equals('john@example.com'));
    });
    
    test('User validation', () {
      expect(
        () => User(
          id: '',
          email: 'invalid-email',
          name: '',
          role: UserRole.user,
          createdAt: DateTime.now(),
        ),
        throwsException,
      );
    });
  });
}
```

---

### **2. Test Services**

```dart
// test/services/webrtc_service_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:your_app/services/webrtc_service.dart';

class MockRTCPeerConnection extends Mock implements RTCPeerConnection {}

void main() {
  late WebRTCService webrtcService;
  late MockRTCPeerConnection mockPeerConnection;
  
  setUp(() {
    mockPeerConnection = MockRTCPeerConnection();
    webrtcService = WebRTCService();
  });
  
  group('WebRTC Service Tests', () {
    test('Create peer connection', () async {
      final peerConnection = await webrtcService.createPeerConnection('peer123');
      
      expect(peerConnection, isNotNull);
      expect(webrtcService.peerConnections['peer123'], isNotNull);
    });
    
    test('Create offer', () async {
      await webrtcService.createPeerConnection('peer123');
      
      final offer = await webrtcService.createOffer('peer123');
      
      expect(offer.type, equals('offer'));
      expect(offer.sdp, isNotNull);
    });
    
    test('Handle ICE candidate', () async {
      when(mockPeerConnection.addIceCandidate(any))
        .thenAnswer((_) async => true);
      
      expect(
        webrtcService.addIceCandidate('peer123', mockIceCandidate),
        completes,
      );
    });
    
    test('Close peer connection', () async {
      await webrtcService.createPeerConnection('peer123');
      await webrtcService.closePeerConnection('peer123');
      
      expect(webrtcService.peerConnections['peer123'], isNull);
    });
  });
}
```

---

### **3. Test Providers**

```dart
// test/providers/auth_provider_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:your_app/providers/auth_provider.dart';

class MockAuthService extends Mock implements AuthService {}

void main() {
  late AuthProvider authProvider;
  late MockAuthService mockAuthService;
  
  setUp(() {
    mockAuthService = MockAuthService();
    authProvider = AuthProvider(authService: mockAuthService);
  });
  
  group('Auth Provider Tests', () {
    test('Login success', () async {
      final mockUser = User(
        id: '123',
        email: 'john@example.com',
        name: 'John',
        role: UserRole.user,
        createdAt: DateTime.now(),
      );
      
      when(mockAuthService.login('john@example.com', 'password123'))
        .thenAnswer((_) async => mockUser);
      
      await authProvider.login('john@example.com', 'password123');
      
      expect(authProvider.isAuthenticated, true);
      expect(authProvider.user?.email, equals('john@example.com'));
    });
    
    test('Login failure', () async {
      when(mockAuthService.login('john@example.com', 'wrongpassword'))
        .thenThrow(AuthException('Invalid credentials'));
      
      expect(
        () => authProvider.login('john@example.com', 'wrongpassword'),
        throwsA(isA<AuthException>()),
      );
      
      expect(authProvider.isAuthenticated, false);
    });
    
    test('Logout clears user data', () async {
      authProvider.logout();
      
      expect(authProvider.user, isNull);
      expect(authProvider.isAuthenticated, false);
    });
  });
}
```

---

## 🖼️ Widget Testing

### **1. Test UI Components**

```dart
// test/widgets/local_video_widget_test.dart

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:your_app/widgets/local_video_widget.dart';

void main() {
  group('Local Video Widget Tests', () {
    testWidgets('Display local video stream', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: LocalVideoWidget(
              videoTrack: mockVideoTrack,
            ),
          ),
        ),
      );
      
      // Verify widget renders
      expect(find.byType(RTCVideoView), findsOneWidget);
    });
    
    testWidgets('Show mute button when audio is on', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: LocalVideoWidget(
              videoTrack: mockVideoTrack,
              isAudioOn: true,
            ),
          ),
        ),
      );
      
      expect(find.byIcon(Icons.mic), findsOneWidget);
    });
  });
}
```

---

### **2. Test Screens**

```dart
// test/screens/room_screen_test.dart

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:your_app/screens/room_screen.dart';

void main() {
  group('Room Screen Tests', () {
    testWidgets('Display room with participants', (WidgetTester tester) async {
      final mockCallProvider = MockCallProvider();
      
      await tester.pumpWidget(
        MaterialApp(
          home: ChangeNotifierProvider<CallProvider>.value(
            value: mockCallProvider,
            child: RoomScreen(roomId: 'room123'),
          ),
        ),
      );
      
      // Verify room items
      expect(find.byType(GridView), findsOneWidget);
    });
    
    testWidgets('Leave room button works', (WidgetTester tester) async {
      final mockCallProvider = MockCallProvider();
      
      await tester.pumpWidget(
        MaterialApp(
          home: ChangeNotifierProvider<CallProvider>.value(
            value: mockCallProvider,
            child: RoomScreen(roomId: 'room123'),
          ),
        ),
      );
      
      // Find and tap leave button
      await tester.tap(find.byIcon(Icons.call_end));
      await tester.pumpAndSettle();
      
      // Verify leave was called
      verify(mockCallProvider.leaveRoom()).called(1);
    });
  });
}
```

---

## 🔗 Integration Testing

### **1. API Integration Tests**

```dart
// test/integration/api_integration_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:your_app/services/api_service.dart';

void main() {
  group('API Integration Tests', () {
    late DioClient dioClient;
    late AuthService authService;
    late DioAdapter mockAdapter;
    
    setUp(() {
      dioClient = DioClient();
      mockAdapter = DioAdapter();
      dioClient.dio.httpClientAdapter = mockAdapter;
      authService = AuthService(dioClient: dioClient);
    });
    
    test('Login and get token', () async {
      // Mock login endpoint
      mockAdapter.onPost(
        '/auth/login',
        (server) => server.reply(200, {
          'user': {'_id': '123', 'email': 'john@example.com'},
          'token': 'jwt_token_here',
        }),
      );
      
      final response = await authService.login(
        'john@example.com',
        'password123',
      );
      
      expect(response.user.id, equals('123'));
      expect(response.token, isNotNull);
    });
    
    test('Create room API call', () async {
      mockAdapter.onPost(
        '/rooms',
        (server) => server.reply(201, {
          '_id': 'room123',
          'name': 'Test Room',
          'createdBy': 'user123',
        }),
      );
      
      final roomService = RoomService(dioClient: dioClient);
      final room = await roomService.createRoom('Test Room');
      
      expect(room.id, equals('room123'));
      expect(room.name, equals('Test Room'));
    });
  });
}
```

---

### **2. WebRTC Signaling Tests**

```dart
// test/integration/webrtc_signaling_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:your_app/services/webrtc_service.dart';
import 'package:your_app/services/socket_service.dart';

class MockSocketService extends Mock implements SocketService {}

void main() {
  group('WebRTC Signaling Tests', () {
    late WebRTCService webrtcService;
    late MockSocketService mockSocketService;
    
    setUp(() {
      mockSocketService = MockSocketService();
      webrtcService = WebRTCService(socketService: mockSocketService);
    });
    
    test('Complete offer-answer exchange', () async {
      // Create peer connections
      await webrtcService.createPeerConnection('peer1');
      await webrtcService.createPeerConnection('peer2');
      
      // Create offer
      final offer = await webrtcService.createOffer('peer1');
      expect(offer.type, equals('offer'));
      
      // Set remote offer
      await webrtcService.setRemoteOffer('peer2', offer);
      
      // Create answer
      final answer = await webrtcService.createAnswer('peer2');
      expect(answer.type, equals('answer'));
      
      // Set remote answer
      await webrtcService.setRemoteAnswer('peer1', answer);
      
      // Verify connection states
      verify(mockSocketService.emit('offer', any)).called(1);
      verify(mockSocketService.emit('answer', any)).called(1);
    });
  });
}
```

---

## 🧑‍💻 Test Coverage

### **Run Tests with Coverage**

```bash
# Run all tests with coverage
flutter test --coverage

# Generate coverage report
lcov --list coverage/lcov.info

# Generate HTML report
genhtml coverage/lcov.info -o coverage/html
open coverage/html/index.html
```

---

### **Expected Coverage Targets**

```yaml
# analysis_options.yaml
dart_code_metrics:
  rules:
    - metric-violations:
        overall-line-coverage-averages: 80
        overall-branch-coverage-averages: 75
```

---

## 🚀 Running Tests

### **Run Specific Test File**

```bash
# Unit tests only
flutter test test/models/ --coverage

# Widget tests
flutter test test/widgets/

# Integration tests
flutter test integration_test/

# Watch mode (re-run on changes)
flutter test --watch

# Run with verbose output
flutter test -v
```

---

### **CI/CD Test Pipeline**

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.10.0'
      
      - run: flutter pub get
      
      - run: flutter test --coverage
      
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## 🐛 Testing Best Practices

### **1. Use Test Fixtures**

```dart
// test/fixtures/test_data.dart

class TestData {
  static const mockRoom = Room(
    id: 'room123',
    name: 'Test Room',
    createdBy: 'user123',
    createdAt: '2025-03-17T10:00:00Z',
  );
  
  static const mockUser = User(
    id: 'user123',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.user,
    createdAt: '2025-03-17T10:00:00Z',
  );
}
```

---

### **2. Use Test Helpers**

```dart
// test/helpers/test_helpers.dart

Future<void> pumpTestApp(
  WidgetTester tester,
  Widget widget,
) async {
  await tester.pumpWidget(
    MaterialApp(
      home: widget,
      theme: ThemeData.light(),
    ),
  );
}

Future<void> tapAndSettle(
  WidgetTester tester,
  Finder finder,
) async {
  await tester.tap(finder);
  await tester.pumpAndSettle();
}
```

---

### **3. Mock External Dependencies**

```dart
class MockWebRTCService extends Mock implements WebRTCService {}
class MockSocketService extends Mock implements SocketService {}
class MockAuthService extends Mock implements AuthService {}

// Usage
setUp(() {
  mockWebRTC = MockWebRTCService();
  mockSocket = MockSocketService();
  mockAuth = MockAuthService();
});
```

---

## ✅ Checklist untuk Testing

- [ ] All models have unit tests
- [ ] All services have unit tests
- [ ] All providers have unit tests
- [ ] All screens have widget tests
- [ ] All critical flows have integration tests
- [ ] Code coverage >= 80%
- [ ] All tests pass locally
- [ ] CI/CD pipeline is green
- [ ] Performance tests included
- [ ] Error scenarios tested

---

**Last Updated**: March 17, 2025
**Difficulty Level**: Intermediate
**Estimated Implementation Time**: 2 weeks (ongoing)

