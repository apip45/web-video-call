class Room {
  final String id;
  final String roomId;
  final String? name;
  final String hostId;
  final bool isActive;
  final DateTime createdAt;
  final List<String> participants;

  Room({
    required this.id,
    required this.roomId,
    this.name,
    required this.hostId,
    this.isActive = true,
    required this.createdAt,
    this.participants = const [],
  });

  factory Room.fromJson(Map<String, dynamic> json) {
    return Room(
      id: json['_id'] ?? json['id'] ?? '',
      roomId: json['roomId'] ?? '',
      name: json['name'],
      hostId: json['host'] ?? '',
      isActive: json['isActive'] ?? true,
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      participants: json['participants'] != null 
        ? List<String>.from(json['participants'])
        : [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'roomId': roomId,
      'name': name,
      'hostId': hostId,
      'isActive': isActive,
      'createdAt': createdAt.toIso8601String(),
      'participants': participants,
    };
  }
}
