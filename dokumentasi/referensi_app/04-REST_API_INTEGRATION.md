# 🔌 REST API Integration - Setup Koneksi dengan Backend

## Comprehensive Guide - REST API Client Setup

Panduan lengkap untuk setup HTTP client dan integrasi dengan REST API backend.

---

## 📦 Dependencies

```yaml
dependencies:
  dio: ^5.3.0              # HTTP client
  pretty_dio_logger: ^1.3.1 # Request/Response logging
  retrofit: ^4.0.0         # REST client code generation
  json_annotation: ^4.8.0  # JSON serialization
  json_serializable: ^6.7.0 # Code generation for JSON

dev_dependencies:
  retrofit_generator: ^8.0.0
  build_runner: ^2.4.0
```

Install:
```bash
flutter pub add dio pretty_dio_logger retrofit json_annotation
flutter pub add --dev retrofit_generator json_serializable build_runner
```

---

## 🏗️ Setup API Service

### **1. Dio Configuration**

File: `lib/shared/services/api_service.dart`

```dart
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

class ApiService {
  late Dio _dio;
  
  ApiService() {
    _initializeDio();
  }
  
  void _initializeDio() {
    // Base configuration
    _dio = Dio(
      BaseOptions(
        baseUrl: 'http://10.0.2.2:3000', // Emulator localhost
        // For physical device: 'http://192.168.1.100:3000'
        connectTimeout: Duration(seconds: 30),
        receiveTimeout: Duration(seconds: 30),
        sendTimeout: Duration(seconds: 30),
        contentType: Headers.jsonContentType,
        responseType: ResponseType.json,
      ),
    );
    
    // Add interceptors
    _addInterceptors();
  }
  
  void _addInterceptors() {
    // 1. Request interceptor - Add auth token
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Get token from storage
          final token = await _getAuthToken();
          
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          
          return handler.next(options);
        },
        onError: (error, handler) async {
          // Handle 401 Unauthorized
          if (error.response?.statusCode == 401) {
            // Token expired, try refresh
            final refreshed = await _refreshToken();
            
            if (refreshed) {
              // Retry original request
              return handler.resolve(
                await _dio.request(
                  error.requestOptions.path,
                  options: Options(
                    method: error.requestOptions.method,
                    headers: error.requestOptions.headers,
                  ),
                  data: error.requestOptions.data,
                  queryParameters: error.requestOptions.queryParameters,
                ),
              );
            }
          }
          
          return handler.next(error);
        },
      ),
    );
    
    // 2. Pretty logger (only in development)
    if (kDebugMode) {
      _dio.interceptors.add(
        PrettyDioLogger(
          requestHeader: true,
          requestBody: true,
          responseHeader: true,
          responseBody: true,
          error: true,
          compact: true,
        ),
      );
    }
  }
  
  Future<String?> _getAuthToken() async {
    // Implementation: Read from secure storage
    // return await StorageService.getToken();
    return null;
  }
  
  Future<bool> _refreshToken() async {
    // Implementation: Call refresh endpoint
    // return await POST('/api/auth/refresh');
    return false;
  }
  
  // Get Dio instance
  Dio get dio => _dio;
  
  // Helper methods
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) {
    return _dio.get(path, queryParameters: queryParameters);
  }
  
  Future<Response> post(String path, {dynamic data}) {
    return _dio.post(path, data: data);
  }
  
  Future<Response> put(String path, {dynamic data}) {
    return _dio.put(path, data: data);
  }
  
  Future<Response> delete(String path) {
    return _dio.delete(path);
  }
}
```

---

### **2. Retrofit API Client**

File: `lib/shared/services/api_client.dart`

```dart
import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

part 'api_client.g.dart';

@RestApi(baseUrl: 'http://10.0.2.2:3000/api')
abstract class ApiClient {
  factory ApiClient(Dio dio, {String baseUrl}) = _ApiClient;
  
  // ============ AUTH ENDPOINTS ============
  
  @POST('/auth/register')
  Future<LoginResponse> register(
    @Body() RegisterRequest request,
  );
  
  @POST('/auth/login')
  Future<LoginResponse> login(
    @Body() LoginRequest request,
  );
  
  @POST('/auth/logout')
  Future<void> logout();
  
  @POST('/auth/refresh')
  Future<LoginResponse> refreshToken(
    @Body() RefreshTokenRequest request,
  );
  
  // ============ USER ENDPOINTS ============
  
  @GET('/user/profile')
  Future<UserResponse> getProfile();
  
  @PUT('/user/profile')
  Future<UserResponse> updateProfile(
    @Body() UpdateUserRequest request,
  );
  
  // ============ ROOM ENDPOINTS ============
  
  @GET('/rooms')
  Future<List<RoomResponse>> getRooms(
    @Query('page') int? page,
    @Query('limit') int? limit,
  );
  
  @POST('/rooms')
  Future<RoomResponse> createRoom(
    @Body() CreateRoomRequest request,
  );
  
  @GET('/rooms/{roomId}')
  Future<RoomResponse> getRoom(
    @Path('roomId') String roomId,
  );
  
  @POST('/rooms/{roomId}/join')
  Future<RoomResponse> joinRoom(
    @Path('roomId') String roomId,
  );
  
  @POST('/rooms/{roomId}/leave')
  Future<void> leaveRoom(
    @Path('roomId') String roomId,
  );
  
  // ============ STATISTICS ENDPOINTS ============
  
  @GET('/stats/rooms/{roomId}')
  Future<RoomStatsResponse> getRoomStats(
    @Path('roomId') String roomId,
  );
  
  @POST('/stats/call')
  Future<void> logCallStats(
    @Body() CallStatsRequest request,
  );
  
  // ============ ADMIN ENDPOINTS ============
  
  @POST('/admin/users/{userId}/camera/disable')
  Future<void> disableUserCamera(
    @Path('userId') String userId,
    @Query('roomId') String roomId,
  );
  
  @POST('/admin/users/{userId}/camera/enable')
  Future<void> enableUserCamera(
    @Path('userId') String userId,
    @Query('roomId') String roomId,
  );
  
  @POST('/admin/users/{userId}/audio/mute')
  Future<void> muteUserAudio(
    @Path('userId') String userId,
    @Query('roomId') String roomId,
  );
  
  @POST('/admin/users/{userId}/audio/unmute')
  Future<void> unmuteUserAudio(
    @Path('userId') String userId,
    @Query('roomId') String roomId,
  );
}
```

Generate Retrofit code:
```bash
flutter pub run build_runner build
# or watch
flutter pub run build_runner watch
```

---

## 📝 Request/Response Models

### **Authentication Models**

File: `lib/features/auth/data/models/login_request.dart`

```dart
import 'package:json_annotation/json_annotation.dart';

part 'login_request.g.dart';

@JsonSerializable()
class LoginRequest {
  final String email;
  final String password;
  
  LoginRequest({
    required this.email,
    required this.password,
  });
  
  factory LoginRequest.fromJson(Map<String, dynamic> json) =>
    _$LoginRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$LoginRequestToJson(this);
}

@JsonSerializable()
class LoginResponse {
  final String token;
  final String refreshToken;
  final UserData user;
  
  LoginResponse({
    required this.token,
    required this.refreshToken,
    required this.user,
  });
  
  factory LoginResponse.fromJson(Map<String, dynamic> json) =>
    _$LoginResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$LoginResponseToJson(this);
}

@JsonSerializable()
class UserData {
  final String id;
  final String name;
  final String email;
  final String? avatar;
  
  UserData({
    required this.id,
    required this.name,
    required this.email,
    this.avatar,
  });
  
  factory UserData.fromJson(Map<String, dynamic> json) =>
    _$UserDataFromJson(json);
  
  Map<String, dynamic> toJson() => _$UserDataToJson(this);
}
```

Generate JSON serialization:
```bash
flutter pub run build_runner build
```

---

## 🔐 Authentication Handling

File: `lib/features/auth/data/datasources/auth_remote_datasource.dart`

```dart
import 'package:dio/dio.dart';
import 'package:webrtc_app/core/exceptions/app_exception.dart';
import 'api_client.dart';

abstract class AuthRemoteDataSource {
  Future<LoginResponse> login(String email, String password);
  Future<LoginResponse> register(String name, String email, String password);
  Future<void> logout();
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final ApiClient _apiClient;
  
  AuthRemoteDataSourceImpl(this._apiClient);
  
  @override
  Future<LoginResponse> login(String email, String password) async {
    try {
      final request = LoginRequest(email: email, password: password);
      final response = await _apiClient.login(request);
      return response;
    } on DioException catch (e) {
      throw _mapDioException(e);
    }
  }
  
  @override
  Future<LoginResponse> register(String name, String email, String password) async {
    try {
      final request = RegisterRequest(
        name: name,
        email: email,
        password: password,
      );
      final response = await _apiClient.register(request);
      return response;
    } on DioException catch (e) {
      throw _mapDioException(e);
    }
  }
  
  @override
  Future<void> logout() async {
    try {
      await _apiClient.logout();
    } on DioException catch (e) {
      throw _mapDioException(e);
    }
  }
  
  NetworkException _mapDioException(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
        return NetworkException('Connection timeout');
      case DioExceptionType.receiveTimeout:
        return NetworkException('Response timeout');
      case DioExceptionType.unknown:
        return NetworkException('No internet connection');
      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode;
        final message = e.response?.data?['message'] ?? 'Server error';
        
        if (statusCode == 401) {
          return NetworkException('Invalid credentials');
        } else if (statusCode == 400) {
          return NetworkException(message);
        } else if (statusCode == 409) {
          return NetworkException('Email already registered');
        }
        return NetworkException('Error: $message');
      default:
        return NetworkException(e.toString());
    }
  }
}
```

---

## 💾 Local Storage Integration

File: `lib/shared/services/storage_service.dart`

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class StorageService {
  static const String _tokenKey = 'auth_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _userKey = 'user_data';
  
  final FlutterSecureStorage _storage;
  
  StorageService(this._storage);
  
  // Token operations
  Future<void> saveToken(String token) async {
    await _storage.write(key: _tokenKey, value: token);
  }
  
  Future<String?> getToken() async {
    return await _storage.read(key: _tokenKey);
  }
  
  Future<void> deleteToken() async {
    await _storage.delete(key: _tokenKey);
  }
  
  // Refresh token operations
  Future<void> saveRefreshToken(String token) async {
    await _storage.write(key: _refreshTokenKey, value: token);
  }
  
  Future<String?> getRefreshToken() async {
    return await _storage.read(key: _refreshTokenKey);
  }
  
  // User data
  Future<void> saveUser(String userJson) async {
    await _storage.write(key: _userKey, value: userJson);
  }
  
  Future<String?> getUser() async {
    return await _storage.read(key: _userKey);
  }
  
  // Clear all
  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
```

---

## 🏢 Repository Implementation

File: `lib/features/auth/data/repositories/auth_repository.dart`

```dart
import 'package:webrtc_app/features/auth/domain/entities/user_entity.dart';

abstract class AuthRepository {
  Future<UserEntity> login(String email, String password);
  Future<UserEntity> register(String name, String email, String password);
  Future<void> logout();
  Future<UserEntity?> getCurrentUser();
}

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;
  final StorageService storageService;
  
  AuthRepositoryImpl({
    required this.remoteDataSource,
    required this.storageService,
  });
  
  @override
  Future<UserEntity> login(String email, String password) async {
    try {
      final response = await remoteDataSource.login(email, password);
      
      // Save tokens
      await storageService.saveToken(response.token);
      await storageService.saveRefreshToken(response.refreshToken);
      
      // Save user data
      final userJson = jsonEncode(response.user.toJson());
      await storageService.saveUser(userJson);
      
      // Convert to entity
      return _userDataToEntity(response.user);
    } catch (e) {
      throw AuthException('Login failed: $e');
    }
  }
  
  @override
  Future<UserEntity> register(String name, String email, String password) async {
    try {
      final response = await remoteDataSource.register(name, email, password);
      
      // Save tokens
      await storageService.saveToken(response.token);
      await storageService.saveRefreshToken(response.refreshToken);
      
      // Save user data
      final userJson = jsonEncode(response.user.toJson());
      await storageService.saveUser(userJson);
      
      return _userDataToEntity(response.user);
    } catch (e) {
      throw AuthException('Registration failed: $e');
    }
  }
  
  @override
  Future<void> logout() async {
    try {
      await remoteDataSource.logout();
      await storageService.clearAll();
    } catch (e) {
      // Even if API fails, clear local data
      await storageService.clearAll();
    }
  }
  
  @override
  Future<UserEntity?> getCurrentUser() async {
    try {
      final userJson = await storageService.getUser();
      if (userJson == null) return null;
      
      final userMap = jsonDecode(userJson) as Map<String, dynamic>;
      final userData = UserData.fromJson(userMap);
      return _userDataToEntity(userData);
    } catch (e) {
      return null;
    }
  }
  
  UserEntity _userDataToEntity(UserData data) {
    return UserEntity(
      id: data.id,
      name: data.name,
      email: data.email,
      avatar: data.avatar,
    );
  }
}
```

---

## 📱 Usage in Provider

File: `lib/features/auth/presentation/providers/auth_provider.dart`

```dart
import 'package:flutter/material.dart';

class AuthProvider extends ChangeNotifier {
  final AuthRepository _authRepository;
  
  UserEntity? _currentUser;
  bool _isLoading = false;
  String? _error;
  
  UserEntity? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _currentUser != null;
  
  AuthProvider(this._authRepository) {
    _checkCurrentUser();
  }
  
  Future<void> login(String email, String password) async {
    _setLoading(true);
    _setError(null);
    
    try {
      _currentUser = await _authRepository.login(email, password);
      _setLoading(false);
      notifyListeners();
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      notifyListeners();
    }
  }
  
  Future<void> register(String name, String email, String password) async {
    _setLoading(true);
    _setError(null);
    
    try {
      _currentUser = await _authRepository.register(name, email, password);
      _setLoading(false);
      notifyListeners();
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      notifyListeners();
    }
  }
  
  Future<void> logout() async {
    try {
      await _authRepository.logout();
      _currentUser = null;
      notifyListeners();
    } catch (e) {
      _setError(e.toString());
      notifyListeners();
    }
  }
  
  Future<void> _checkCurrentUser() async {
    _currentUser = await _authRepository.getCurrentUser();
    notifyListeners();
  }
  
  void _setLoading(bool value) => _isLoading = value;
  void _setError(String? value) => _error = value;
}

// Provider for MultiProvider
final authProvider = ChangeNotifierProvider(
  (ref) => AuthProvider(AuthRepositoryImpl(...)),
);
```

---

## 🎯 Usage in UI

```dart
class LoginPage extends StatefulWidget {
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  late TextEditingController _emailController;
  late TextEditingController _passwordController;
  
  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController();
    _passwordController = TextEditingController();
  }
  
  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, _) {
        if (authProvider.isLoading) {
          return Center(child: CircularProgressIndicator());
        }
        
        return Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: [
                TextField(
                  controller: _emailController,
                  decoration: InputDecoration(
                    labelText: 'Email',
                    errorText: authProvider.error,
                  ),
                ),
                TextField(
                  controller: _passwordController,
                  decoration: InputDecoration(labelText: 'Password'),
                  obscureText: true,
                ),
                ElevatedButton(
                  onPressed: () {
                    final email = _emailController.text;
                    final password = _passwordController.text;
                    
                    authProvider.login(email, password);
                    
                    // Navigate on success
                    if (authProvider.isAuthenticated) {
                      Navigator.pushReplacementNamed(context, '/home');
                    }
                  },
                  child: Text('Login'),
                ),
              ],
            ),
          ),
        );
      },
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

---

## 🧪 Testing API Integration

```dart
test('Login returns user on successful API call', () async {
  // Arrange
  final mockApiClient = MockApiClient();
  const email = 'test@example.com';
  const password = 'password123';
  
  when(mockApiClient.login(any))
    .thenAnswer((_) async => mockLoginResponse);
  
  final datasource = AuthRemoteDataSourceImpl(mockApiClient);
  
  // Act
  final result = await datasource.login(email, password);
  
  // Assert
  expect(result.user.email, email);
});
```

---

## ⚠️ Error Handling

```dart
// Custom exception
class NetworkException implements Exception {
  final String message;
  NetworkException(this.message);
  
  @override
  String toString() => message;
}

// In datasource
try {
  // API call
} on DioException catch (e) {
  switch (e.type) {
    case DioExceptionType.connectionTimeout:
      throw NetworkException('Connection timeout');
    case DioExceptionType.badResponse:
      if (e.response?.statusCode == 401) {
        throw NetworkException('Invalid credentials');
      }
      throw NetworkException('Server error');
    default:
      throw NetworkException('Unknown error');
  }
}
```

---

## 🚀 Complete Setup Checklist

- [ ] Add dependencies (dio, retrofit, json_annotation, etc)
- [ ] Create `ApiService` with Dio configuration
- [ ] Create `ApiClient` with Retrofit
- [ ] Create models with JSON serialization
- [ ] Create `AuthRemoteDataSource`
- [ ] Create `StorageService` for token management
- [ ] Create `AuthRepositoryImpl`
- [ ] Create `AuthProvider`
- [ ] Create login/register pages with UI
- [ ] Test login/register flow
- [ ] Setup error handling
- [ ] Setup token refresh logic

---

**Last Updated**: March 17, 2025
**Status**: Complete
**References**: Website API endpoints in `../../04-API_ENDPOINTS.md`

