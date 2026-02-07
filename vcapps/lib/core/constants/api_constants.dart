class ApiConstants {
  // Base URL - Update this to your server URL
  // For Android emulator: use 10.0.2.2 instead of localhost
  // For physical device: use your computer's IP address
  static const String baseUrl = 'https://calls.mikan.my.id';
  
  // API Endpoints - Mobile app uses /api prefix
  static const String loginEndpoint = '/api/auth/login';
  static const String registerEndpoint = '/api/auth/register';
  static const String createRoomEndpoint = '/api/room/create';
  static const String getRoomEndpoint = '/api/room';
  
  // Socket.IO URL
  static String get socketUrl => baseUrl;
  
  // STUN/TURN Servers - Optimized format for flutter_webrtc
  // Using same exact config as working web version
  static const Map<String, dynamic> iceServers = {
    'iceServers': [
      // Primary STUN server (Google)
      {'urls': 'stun:stun.l.google.com:19302'},
      
      // TURN server - UDP (Primary - same as web)
      {
        'urls': 'turn:turn.mikan.my.id:3478',
        'username': 'admin',
        'credential': 'rahasia123',
        'credentialType': 'password',
      },
      
      // TURN server - TCP (Alternative - explicit transport)
      {
        'urls': 'turn:turn.mikan.my.id:3478?transport=tcp',
        'username': 'admin',
        'credential': 'rahasia123',
        'credentialType': 'password',
      },
      
      // TURN server - Port 80 for firewall bypass
      {
        'urls': 'turn:turn.mikan.my.id:80?transport=tcp',
        'username': 'admin',
        'credential': 'rahasia123',
        'credentialType': 'password',
      },
      
      // TURNS server (TLS) for strict firewall
      {
        'urls': 'turns:turn.mikan.my.id:5349',
        'username': 'admin',
        'credential': 'rahasia123',
        'credentialType': 'password',
      },
    ],
  };
}
