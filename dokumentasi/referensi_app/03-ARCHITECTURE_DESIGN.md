# 🏗️ Architecture Design - Rancangan Sistem Aplikasi

## Clean Architecture & Design Patterns untuk Flutter App

Dokumen ini menjelaskan arsitektur aplikasi yang digunakan dan design patterns untuk scalability dan maintainability.

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                   │
│  Pages │ Widgets │ Provider (State Management)           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                        │
│  Entities │ Repositories (Abstract) │ UseCases          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                       DATA LAYER                         │
│  Models │ Repositories (Implementation) │ DataSources   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   EXTERNAL LAYER                         │
│  API │ Socket.IO │ WebRTC │ Local Storage │ Device      │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Clean Architecture Layers

### **1. Presentation Layer** (UI & State Management)

**Tanggung Jawab**:
- Display data kepada user
- Handle user interactions
- Manage UI state dengan Provider

**Komponen**:
- **Pages**: Full-screen widgets (LoginPage, RoomPage, etc)
- **Widgets**: Reusable UI components
- **Providers**: State management & business logic coordination

```
presentation/
├── pages/         # Full screens
│   └── login_page.dart
│       class LoginPage extends StatelessWidget { }
│
├── widgets/       # Reusable components
│   ├── login_form.dart
│   │   class LoginForm extends StatefulWidget { }
│   └── app_button.dart
│       class AppButton extends StatelessWidget { }
│
└── providers/     # State management
    └── auth_provider.dart
        class AuthProvider extends ChangeNotifier { }
```

**Dependency Flow**: Pages → Providers → UseCases

---

### **2. Domain Layer** (Business Logic)

**Tanggung Jawab**:
- Define business rules
- Abstract repositories
- Define use cases (orchestrate logic)

**Komponen**:
- **Entities**: Pure Dart objects (no framework dependencies)
- **Repositories** (Abstract): Contracts for data sources
- **UseCases**: Specific business logic operations

```
domain/
├── entities/              # Business objects
│   └── user_entity.dart
│       class UserEntity {
│         final String id;
│         final String name;
│       }
│
├── repositories/          # Abstract contracts
│   └── auth_repository.dart
│       abstract class AuthRepository {
│         Future<UserEntity> login(String email, String password);
│       }
│
└── usecases/             # Business operations
    ├── login_usecase.dart
    │   class LoginUseCase {
    │     final AuthRepository authRepository;
    │     Future<UserEntity> call(String email, String password);
    │   }
    └── register_usecase.dart
        class RegisterUseCase { }
```

**Dependency**: Domain → Nothing (Pure Dart)

---

### **3. Data Layer** (Handle Data)

**Tanggung Jawab**:
- Implement repositories
- Fetch from external sources
- Transform to/from network format

**Komponen**:
- **Models**: Data with serialization (JSON conversion)
- **DataSources**: API clients, local storage, etc
- **Repositories** (Implementation): Coordinate data sources

```
data/
├── models/                # API data models
│   └── user_model.dart
│       class UserModel extends UserEntity {
│         factory UserModel.fromJson(Map<String, dynamic> json);
│         Map<String, dynamic> toJson();
│       }
│
├── datasources/           # API, storage, etc
│   └── auth_remote_datasource.dart
│       abstract class AuthRemoteDataSource {
│         Future<UserModel> login(String email, String password);
│       }
│       class AuthRemoteDataSourceImpl {
│         final Dio dio;
│       }
│
└── repositories/          # Implement abstract
    └── auth_repository.dart
        class AuthRepositoryImpl implements AuthRepository {
          final AuthRemoteDataSource remoteDataSource;
          final AuthLocalDataSource localDataSource;
          
          Future<UserEntity> login(String email, String password) async {
            try {
              // Call datasource
              // Return UserEntity
            } catch (e) {
              // Error handling
            }
          }
        }
```

**Dependency**: Data → Domain

---

### **4. External/Infrastructure Layer** (Tools & Services)

**Tanggung Jawab**:
- External API calls
- Socket.IO connection
- WebRTC peer management
- Local storage
- Device functions

**Komponen**:
- **Services**: HTTP client, Socket client, WebRTC engine
- **Utils**: Helpers & utilities

```
shared/services/
├── api_service.dart           # Dio HTTP client
│   class ApiService {
│     final Dio dio;
│     Future<Response> get(String path);
│     Future<Response> post(String path, data);
│   }
│
├── socket_service.dart        # Socket.IO client
│   class SocketService {
│     final Socket socket;
│     void emit(String event, dynamic data);
│     void on(String event, callback);
│   }
│
├── webrtc_service.dart        # WebRTC manager
│   class WebRTCService {
│     final RTCPeerConnection peerConnection;
│     Future<void> createOffer();
│     Future<void> addIceCandidate(...);
│   }
│
└── storage_service.dart       # Secure storage
    class StorageService {
      Future<void> saveToken(String token);
      Future<String?> getToken();
    }
```

---

## 📐 Design Patterns

### **1. Repository Pattern**

Abstraction untuk data access:

```dart
// Domain layer
abstract class AuthRepository {
  Future<UserEntity> login(String email, String password);
  Future<void> logout();
  Future<UserEntity> getCurrentUser();
}

// Data layer
class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;
  final AuthLocalDataSource localDataSource;
  
  @override
  Future<UserEntity> login(String email, String password) async {
    try {
      // Call API
      final userModel = await remoteDataSource.login(email, password);
      
      // Save locally
      await localDataSource.saveUser(userModel);
      
      // Return entity
      return userModel;
    } catch (e) {
      throw AuthException(e.toString());
    }
  }
}

// Presentation layer
class AuthProvider extends ChangeNotifier {
  final AuthRepository authRepository;
  
  Future<void> login(String email, String password) async {
    try {
      _user = await authRepository.login(email, password);
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }
}
```

---

### **2. Provider Pattern** (State Management)

Menggunakan `provider` package untuk state management:

```dart
// Define provider
final authProvider = ChangeNotifierProvider((ref) {
  return AuthProvider(authRepository);
});

// Use in Widget
class LoginPage extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch provider value
    final authProvider = ref.watch(authProvider);
    
    // Use provider methods
    return ElevatedButton(
      onPressed: () {
        ref.read(authProvider).login(email, password);
      },
      child: Text('Login'),
    );
  }
}

// Or with Provider (simpler)
class LoginPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, child) {
        return ElevatedButton(
          onPressed: () {
            authProvider.login(email, password);
          },
          child: Text('Login'),
        );
      },
    );
  }
}
```

---

### **3. Service Locator Pattern** (Dependency Injection)

Menggunakan `GetIt` untuk dependency injection:

```dart
// setup_service_locator.dart
import 'package:get_it/get_it.dart';

final getIt = GetIt.instance;

void setupServiceLocator() {
  // External services
  getIt.registerSingleton<Dio>(ApiService().dio);
  getIt.registerSingleton<Socket>(SocketService().socket);
  
  // Data sources
  getIt.registerSingleton<AuthRemoteDataSource>(
    AuthRemoteDataSourceImpl(dio: getIt<Dio>()),
  );
  
  // Repositories
  getIt.registerSingleton<AuthRepository>(
    AuthRepositoryImpl(
      remoteDataSource: getIt<AuthRemoteDataSource>(),
      localDataSource: getIt<AuthLocalDataSource>(),
    ),
  );
  
  // Use cases
  getIt.registerSingleton<LoginUseCase>(
    LoginUseCase(getIt<AuthRepository>()),
  );
  
  // Providers
  getIt.registerSingleton<AuthProvider>(
    AuthProvider(getIt<AuthRepository>()),
  );
}

// main.dart
void main() {
  setupServiceLocator();
  runApp(MyApp());
}

// Use in pages
class LoginPage extends StatelessWidget {
  final authProvider = getIt<AuthProvider>();
}
```

---

### **4. Factory Pattern** (Object Creation)

```dart
// Models
class UserModel {
  final String id;
  final String name;
  final String email;
  
  UserModel({
    required this.id,
    required this.name,
    required this.email,
  });
  
  // Factory for JSON deserialization
  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'],
      name: json['name'],
      email: json['email'],
    );
  }
  
  // Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
    };
  }
  
  // Copy with
  UserModel copyWith({
    String? id,
    String? name,
    String? email,
  }) {
    return UserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
    );
  }
}
```

---

## 🔄 Data Flow Example: Login Feature

```
USER INPUT (Email, Password)
        ↓
┌───────────────────────────────────┐
│  PRESENTATION LAYER (LoginPage)    │
│  - Captures user input             │
│  - Calls AuthProvider.login()      │
└───────────┬───────────────────────┘
            ↓
┌───────────────────────────────────┐
│  PRESENTATION LAYER (AuthProvider) │
│  - ChangeNotifier state provider   │
│  - Calls LoginUseCase              │
│  - Updates UI state (loading, etc) │
└───────────┬───────────────────────┘
            ↓
┌───────────────────────────────────┐
│  DOMAIN LAYER (LoginUseCase)       │
│  - Business logic validation       │
│  - Calls AuthRepository            │
└───────────┬───────────────────────┘
            ↓
┌───────────────────────────────────┐
│  DATA LAYER (AuthRepositoryImpl)    │
│  - Orchestrates data sources       │
│  - Handles errors                  │
│  - Saves to local storage          │
└───────────┬───────────────────────┘
            ↓
┌───────────────────────────────────┐
│  EXTERNAL (RemoteDataSource)       │
│  - Calls API: POST /api/login      │
│  - Receives UserModel response     │
└───────────┬───────────────────────┘
            ↓
        API SERVER
        
        ← Back through layers
        
        Success: USER LOGGED IN ✅
        Error: SHOW ERROR MESSAGE ❌
```

---

## 📊 State Management with Provider

### **Simple State (ChangeNotifier)**

```dart
class AuthProvider extends ChangeNotifier {
  UserEntity? _user;
  bool _isLoading = false;
  String? _error;
  
  UserEntity? get user => _user;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  final AuthRepository authRepository;
  
  AuthProvider(this.authRepository);
  
  Future<void> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    
    try {
      _user = await authRepository.login(email, password);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }
}

// Use in Widget
class LoginPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, _) {
        if (authProvider.isLoading) {
          return CircularProgressIndicator();
        }
        
        if (authProvider.error != null) {
          return Text('Error: ${authProvider.error}');
        }
        
        return ElevatedButton(
          onPressed: () => authProvider.login(email, password),
          child: Text('Login'),
        );
      },
    );
  }
}
```

---

### **Complex State (Multi-Provider)**

```dart
// Combine multiple providers
class RoomProvider extends ChangeNotifier {
  List<RoomEntity> _rooms = [];
  RoomEntity? _currentRoom;
  
  final RoomRepository roomRepository;
  final SocketRepository socketRepository;
  
  RoomProvider(this.roomRepository, this.socketRepository);
  
  Future<void> fetchRooms() async {
    _rooms = await roomRepository.getRooms();
    notifyListeners();
  }
  
  Future<void> joinRoom(String roomId) async {
    _currentRoom = await roomRepository.joinRoom(roomId);
    
    // Connect socket
    await socketRepository.connect(roomId);
    socketRepository.onRemoteOffer((offer) {
      // Handle WebRTC offer
    });
    
    notifyListeners();
  }
}

// Use multiple providers
class RoomPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => RoomProvider(...)),
        ChangeNotifierProvider(create: (_) => WebRTCProvider(...)),
        ChangeNotifierProvider(create: (_) => StatsProvider(...)),
      ],
      child: ConsumerWidget(
        builder: (context, ref, _) {
          final roomProvider = ref.watch(roomProvider);
          final webrtcProvider = ref.watch(webrtcProvider);
          
          return RoomPageContent();
        },
      ),
    );
  }
}
```

---

## 🔌 WebRTC Architecture

```
┌─────────────────────────────────────────┐
│       WEBSOCKET SIGNALING                │
│  (Socket.IO) - Coordinates WebRTC       │
│  - Offer/Answer exchange                │
│  - ICE candidates handling              │
│  - Room/peer state sync                 │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│      WebRTC PEER CONNECTION             │
│  (flutter_webrtc package)               │
│  - Create single RTCPeerConnection      │
│  - Add/remove tracks                    │
│  - Handle renegotiation                 │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│      MEDIA STREAMS                      │
│  - Local stream (camera + mic)          │
│  - Remote streams                       │
│  - Audio output routing                 │
└─────────────────────────────────────────┘
```

---

## 📱 Feature Module Architecture

Setiap feature diorganisir dengan struktur lengkap:

```
features/auth/
├── data/
│   ├── datasources/
│   │   ├── auth_remote_datasource.dart
│   │   └── auth_local_datasource.dart
│   ├── models/
│   │   ├── user_model.dart
│   │   └── login_response_model.dart
│   └── repositories/
│       └── auth_repository_impl.dart
│
├── domain/
│   ├── entities/
│   │   └── user_entity.dart
│   ├── repositories/
│   │   └── auth_repository.dart
│   └── usecases/
│       ├── login_usecase.dart
│       ├── register_usecase.dart
│       └── logout_usecase.dart
│
└── presentation/
    ├── providers/
    │   └── auth_provider.dart
    ├── pages/
    │   ├── login_page.dart
    │   └── register_page.dart
    └── widgets/
        ├── login_form.dart
        └── register_form.dart
```

**Keuntungan**:
- ✅ Isolated feature (mudah ditest)
- ✅ Clear dependency flow
- ✅ Easy to add/remove features
- ✅ Can be developed independently

---

## 🎯 Error Handling Architecture

```
Custom Exceptions
    ↓
┌──────────────┐
│ AppException │ - Base class
└──────────────┘
    ↑
    ├── NetworkException (API error)
    ├── WebRTCException (Media error)
    ├── AuthException (Auth error)
    ├── StorageException (Storage error)
    └── SocketException (Socket error)
    
    ↓
Handled in Repository
    ↓
Converted to UI-friendly messages
    ↓
Displayed in Provider Error State
    ↓
Shown to User in UI
```

**Implementation**:
```dart
// Custom exceptions
abstract class AppException implements Exception {
  final String message;
  AppException(this.message);
  
  @override
  String toString() => message;
}

class NetworkException extends AppException {
  NetworkException(String message) : super(message);
}

class WebRTCException extends AppException {
  WebRTCException(String message) : super(message);
}

// In Repository
Future<UserEntity> login(...) async {
  try {
    // Make API call
  } on DioException catch (e) {
    throw NetworkException('Login failed: ${e.message}');
  }
}

// In Provider (catch & show to user)
Future<void> login(...) async {
  try {
    _user = await authRepository.login(...);
  } on NetworkException catch (e) {
    _error = e.toString();
  } on AppException catch (e) {
    _error = 'Something went wrong';
  }
  notifyListeners();
}

// In UI
if (authProvider.error != null) {
  showErrorSnackbar(authProvider.error!);
}
```

---

## 🧪 Testability

Dengan clean architecture, testing menjadi lebih mudah:

```dart
// Test UseCase (no dependencies on UI or external)
test('LoginUseCase returns user when credentials correct', () async {
  // Arrange
  final mockRepository = MockAuthRepository();
  when(mockRepository.login('email', 'pass'))
    .thenAnswer((_) async => testUser);
  
  final usecase = LoginUseCase(mockRepository);
  
  // Act
  final result = await usecase('email', 'pass');
  
  // Assert
  expect(result, testUser);
});

// Test Repository (isolated from API)
test('AuthRepository saves user to local storage', () async {
  // Arrange
  final mockRemoteDS = MockAuthRemoteDataSource();
  final mockLocalDS = MockAuthLocalDataSource();
  
  when(mockRemoteDS.login(...))
    .thenAnswer((_) async => userModel);
  
  final repo = AuthRepositoryImpl(mockRemoteDS, mockLocalDS);
  
  // Act
  await repo.login(...);
  
  // Assert
  verify(mockLocalDS.saveUser(userModel)).called(1);
});
```

---

## 📈 Scalability Considerations

### **As App Grows**

```
├── Core Features (Auth, Rooms)
├── Call Features (WebRTC, Media, Controls)
├── Advanced Features (Admin, Stats, Recording)
└── Platform-Specific Features (Push, Background)
```

### **State Management Evolution**

1. **Start**: Provider (ChangeNotifier)
2. **Scale**: Provider (StateNotifier) + Riverpod
3. **Complex**: GetX / MobX / BLoC

---

## 🚀 Next Steps

1. ✅ Understand architecture
2. 📖 Read next file: `04-REST_API_INTEGRATION.md`
3. 💻 Start implementing with this architecture

---

**Last Updated**: March 17, 2025
**Architecture**: Clean Architecture + Provider Pattern
**Status**: Production Ready

