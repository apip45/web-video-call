class User {
  final String id;
  final String username;
  final String email;
  final String? displayName;
  final String role;

  User({
    required this.id,
    required this.username,
    required this.email,
    this.displayName,
    this.role = 'user',
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['_id'] ?? json['id'] ?? '',
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      displayName: json['displayName'],
      role: json['role'] ?? 'user',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'displayName': displayName,
      'role': role,
    };
  }
}
