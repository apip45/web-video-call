# Camera Device Cleanup Fix

## Problem
When admin changed video quality to lower resolution (below 1080p) while using back camera, the app would crash with two errors:

1. **PlatformException**: `mediaStreamRemoveTrack() track [id] is null`
2. **CameraEventsHandler.onCameraError**: `Camera device could not be opened because there are too many other open camera devices`

The issue only occurred with back camera. Front camera worked fine at all resolutions.

## Root Cause

The bug was in `applyVideoQuality()` method in [webrtc_service.dart](vcapps/lib/core/services/webrtc_service.dart):

```dart
// BEFORE (WRONG):
// Stop old video tracks
for (final track in oldVideoTracks) {
  track.stop();  // Makes track null
}

// Replace video track in local stream
_localStream!.removeTrack(oldVideoTracks.first);  // ERROR: Tries to remove null track
_localStream!.addTrack(newVideoTrack);
```

**Problem**: When you call `track.stop()`, it releases the track and makes it null. Then trying to remove a null track from the stream causes `PlatformException`.

Additionally:
- Failed attempts left camera devices open without proper cleanup
- Multiple camera init attempts accumulated, causing "too many open camera devices" error
- Always defaulting to front camera (`facingMode: 'user'`) instead of preserving current camera

## Solution

Fixed three issues:

### 1. Correct Track Cleanup Order

Remove tracks from stream BEFORE stopping them:

```dart
// AFTER (CORRECT):
// Replace video track in local stream BEFORE stopping old tracks
final newVideoTrack = newStream.getVideoTracks().first;

if (oldVideoTracks.isNotEmpty) {
  final oldVideoTrack = oldVideoTracks.first;
  _localStream!.removeTrack(oldVideoTrack);  // Remove while still valid
  print('🗑️ Removed old video track from stream');
}

_localStream!.addTrack(newVideoTrack);
print('➕ Added new video track to stream');

// NOW stop old video tracks (cleanup) - AFTER removing from stream
for (final track in oldVideoTracks) {
  try {
    track.stop();  // Stop/cleanup after removal
    print('⏹️ Stopped old video track: ${track.id}');
  } catch (e) {
    print('⚠️ Error stopping old track: $e');
  }
}
```

### 2. Preserve Current Camera (Facing Mode)

Detect and preserve current camera (front/back) when applying quality:

```dart
// Detect current facing mode from active video track
String facingMode = 'user'; // default to front camera
if (oldVideoTracks.isNotEmpty) {
  try {
    final settings = await oldVideoTracks.first.getSettings();
    // facingMode can be 'user' (front) or 'environment' (back)
    facingMode = settings['facingMode'] ?? 'user';
    print('📹 Current facing mode: $facingMode');
  } catch (e) {
    print('⚠️ Could not detect facing mode, using default: $e');
  }
}

// Use detected facing mode in new stream
final newStream = await navigator.mediaDevices.getUserMedia({
  'video': {
    'facingMode': facingMode, // Use current camera
    // ... other constraints
  },
});
```

### 3. Cleanup Temporary Stream

Properly cleanup the temporary stream created for getting new video track:

```dart
// Cleanup: Stop and dispose audio tracks from newStream (not needed)
final audioTracks = newStream.getAudioTracks();
for (final track in audioTracks) {
  track.stop();
}
newStream.dispose();
print('🧹 Cleaned up temporary stream');
```

## Testing

Test scenarios:

✅ **Front camera → 720p**: Already worked, still works
✅ **Back camera → 720p**: Previously failed, now works
✅ **Back camera → 480p**: Previously failed, now works
✅ **Back camera → 360p**: Previously failed, now works
✅ **Multiple quality changes**: No camera device leaks
✅ **Quality change preserves camera**: Back camera stays on back, front stays on front

## Technical Details

**Track Lifecycle**:
1. Track is created from `getUserMedia()`
2. Track is added to stream
3. Track is used in peer connection
4. **Remove from stream first** (while track is still valid)
5. **Then stop/dispose** (cleanup resources)

**Why Order Matters**:
- `removeTrack()` needs a valid track reference
- `stop()` releases track resources and makes it null
- Calling `stop()` before `removeTrack()` causes null pointer error

**Camera Device Management**:
- Each `getUserMedia()` call opens a camera device
- Must properly stop old tracks to release camera device
- Improper cleanup causes "too many camera devices" error
- Error handling with try-catch prevents partial cleanup failures

## Related Files

- [webrtc_service.dart](vcapps/lib/core/services/webrtc_service.dart) - `applyVideoQuality()` method
- [video_quality_presets.dart](vcapps/lib/core/constants/video_quality_presets.dart) - Quality presets
- [room_screen.dart](vcapps/lib/screens/room/room_screen.dart) - Video quality dialog UI

## References

- Original issue: User reported error when switching quality with back camera
- Error logs: `mediaStreamRemoveTrack() track is null` + `too many open camera devices`
- Flutter WebRTC: [flutter_webrtc package](https://pub.dev/packages/flutter_webrtc)
