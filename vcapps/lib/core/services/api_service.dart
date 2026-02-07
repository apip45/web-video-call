import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/api_constants.dart';

class ApiService {
  static Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, dynamic>> login(String username, String password) async {
    try {
      final url = '${ApiConstants.baseUrl}${ApiConstants.loginEndpoint}';
      print('🔵 Login request to: $url');
      
      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': username,
          'password': password,
        }),
      );

      print('🔵 Response status: ${response.statusCode}');
      print('🔵 Response body: ${response.body.substring(0, response.body.length > 200 ? 200 : response.body.length)}');

      if (response.statusCode == 200) {
        try {
          return jsonDecode(response.body);
        } catch (e) {
          throw Exception('Server mengembalikan response yang tidak valid. Pastikan server backend berjalan dengan benar.');
        }
      } else if (response.statusCode >= 400 && response.statusCode < 500) {
        try {
          final error = jsonDecode(response.body);
          throw Exception(error['message'] ?? 'Login gagal');
        } catch (e) {
          throw Exception('Login gagal. Status code: ${response.statusCode}');
        }
      } else {
        throw Exception('Server error. Status code: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Login error: $e');
      if (e.toString().contains('SocketException')) {
        throw Exception('Tidak dapat terhubung ke server. Pastikan:\n1. Server backend sedang berjalan\n2. URL server benar\n3. Koneksi internet aktif');
      }
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  static Future<Map<String, dynamic>> register(
    String username,
    String email,
    String password,
  ) async {
    try {
      final url = '${ApiConstants.baseUrl}${ApiConstants.registerEndpoint}';
      print('🔵 Register request to: $url');
      
      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': username,
          'email': email,
          'password': password,
        }),
      );

      print('🔵 Response status: ${response.statusCode}');

      if (response.statusCode == 201) {
        try {
          return jsonDecode(response.body);
        } catch (e) {
          throw Exception('Server mengembalikan response yang tidak valid.');
        }
      } else {
        try {
          final error = jsonDecode(response.body);
          throw Exception(error['message'] ?? 'Registrasi gagal');
        } catch (e) {
          throw Exception('Registrasi gagal. Status code: ${response.statusCode}');
        }
      }
    } catch (e) {
      print('❌ Register error: $e');
      if (e.toString().contains('SocketException')) {
        throw Exception('Tidak dapat terhubung ke server.');
      }
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  static Future<Map<String, dynamic>> createRoom(String? name) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('${ApiConstants.baseUrl}${ApiConstants.createRoomEndpoint}'),
        headers: headers,
        body: jsonEncode({
          if (name != null && name.isNotEmpty) 'name': name,
        }),
      );

      if (response.statusCode == 201) {
        return jsonDecode(response.body);
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['message'] ?? 'Gagal membuat room');
      }
    } catch (e) {
      throw Exception('Error: $e');
    }
  }

  static Future<Map<String, dynamic>> getRoom(String roomId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('${ApiConstants.baseUrl}${ApiConstants.getRoomEndpoint}/$roomId'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['message'] ?? 'Room tidak ditemukan');
      }
    } catch (e) {
      throw Exception('Error: $e');
    }
  }

  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  static Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
  }

  static Future<void> saveUser(Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user', jsonEncode(user));
  }

  static Future<Map<String, dynamic>?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString('user');
    if (userStr != null) {
      return jsonDecode(userStr);
    }
    return null;
  }

  static Future<void> clearUser() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('user');
  }
}
