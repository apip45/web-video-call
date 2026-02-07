/// Video Quality Presets
/// Matches web implementation for consistency
class VideoQualityPreset {
  final String key;
  final String label;
  final int width;
  final int height;
  final int maxBitrate; // kbps
  final int minBitrate; // kbps
  final int idealBitrate; // kbps
  final int maxFramerate;
  final int idealFramerate;

  const VideoQualityPreset({
    required this.key,
    required this.label,
    required this.width,
    required this.height,
    required this.maxBitrate,
    required this.minBitrate,
    required this.idealBitrate,
    required this.maxFramerate,
    required this.idealFramerate,
  });

  Map<String, dynamic> toJson() => {
        'resolution': key,
        'width': width,
        'height': height,
        'maxBitrate': maxBitrate,
        'maxFramerate': maxFramerate,
      };
}

class VideoQualityPresets {
  static const preset360p = VideoQualityPreset(
    key: '360p',
    label: '360p (nHD)',
    width: 640,
    height: 360,
    maxBitrate: 500,
    minBitrate: 300,
    idealBitrate: 400,
    maxFramerate: 24,
    idealFramerate: 24,
  );

  static const preset480p = VideoQualityPreset(
    key: '480p',
    label: '480p (SD)',
    width: 854,
    height: 480,
    maxBitrate: 800,
    minBitrate: 500,
    idealBitrate: 650,
    maxFramerate: 30,
    idealFramerate: 30,
  );

  static const preset720p = VideoQualityPreset(
    key: '720p',
    label: '720p (HD)',
    width: 1280,
    height: 720,
    maxBitrate: 1500,
    minBitrate: 1000,
    idealBitrate: 1200,
    maxFramerate: 30,
    idealFramerate: 30,
  );

  static const preset1080p = VideoQualityPreset(
    key: '1080p',
    label: '1080p (Full HD)',
    width: 1920,
    height: 1080,
    maxBitrate: 3000,
    minBitrate: 2000,
    idealBitrate: 2500,
    maxFramerate: 30,
    idealFramerate: 30,
  );

  static const List<VideoQualityPreset> allPresets = [
    preset360p,
    preset480p,
    preset720p,
    preset1080p,
  ];

  static VideoQualityPreset? getPresetByKey(String key) {
    try {
      return allPresets.firstWhere((p) => p.key == key);
    } catch (e) {
      return null;
    }
  }

  static List<String> get presetKeys => allPresets.map((p) => p.key).toList();
  static List<String> get presetLabels =>
      allPresets.map((p) => p.label).toList();
}
