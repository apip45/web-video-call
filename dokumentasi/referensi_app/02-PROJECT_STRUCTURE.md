# 📂 Project Structure - Organisasi Folder Flutter App

## Struktur Folder yang Optimal untuk Aplikasi WebRTC

Dokumen ini menjelaskan folder structure yang recommended untuk mendukung clean architecture dan scalability.

---

## 📊 High-Level Struktur

```
webrtc_app/
├── lib/                          # Source code utama
│   ├── core/                     # Core business logic & configs
│   ├── features/                 # Feature-specific code
│   ├── shared/                   # Shared services, models, widgets
│   ├── main.dart                 # Entry point
│   └── config/                   # App configuration
├── test/                         # Unit & Widget tests
├── assets/                       # Images, icons, fonts
├── android/                      # Android-specific code
├── ios/                          # iOS-specific code
├── web/                          # Web platform files
├── windows/                      # Windows platform files
├── linux/                        # Linux platform files
├── macos/                        # macOS platform files
├── pubspec.yaml                  # Dependencies & metadata
├── .env                          # Environment variables
├── .gitignore                    # Git ignore
├── analysis_options.yaml         # Linter rules
└── README.md                     # Project documentation
```

---

## 🨰 Detailed Folder Structure

### **1. lib/ - Aplikasi Utama**

```
lib/
│
├── core/                         # Core aplikasi
│   ├── config/
│   │   ├── app_config.dart       # App configuration
│   │   ├── env_config.dart       # Environment config (.env loader)
│   │   ├── api_config.dart       # API configuration
│   │   └── webrtc_config.dart    # WebRTC configuration
│   │
│   ├── constants/
│   │   ├── app_constants.dart    # App-wide constants
│   │   ├── api_endpoints.dart    # API endpoint constants
│   │   ├── socket_events.dart    # Socket event names
│   │   ├── webrtc_constants.dart # WebRTC ICE servers, etc
│   │   └── ui_constants.dart     # Colors, sizes, durations
│   │
│   ├── providers/                # Global providers (Provider state)
│   │   ├── auth_provider.dart    # Authentication state
│   │   ├── app_provider.dart     # App-wide state (theme, etc)
│   │   └── error_provider.dart   # Global error handling
│   │
│   ├── exceptions/
│   │   ├── app_exception.dart    # Custom exceptions
│   │   ├── network_exception.dart
│   │   └── webrtc_exception.dart
│   │
│   └── logger/
│       └── app_logger.dart       # Logging utility
│
├── features/                     # Feature modules
│   │
│   ├── auth/                     # Authentication feature
│   │   ├── data/
│   │   │   ├── datasources/
│   │   │   │   ├── auth_local_datasource.dart
│   │   │   │   └── auth_remote_datasource.dart
│   │   │   ├── models/
│   │   │   │   ├── login_request.dart
│   │   │   │   ├── register_request.dart
│   │   │   │   └── token_response.dart
│   │   │   └── repositories/
│   │   │       └── auth_repository.dart
│   │   │
│   │   ├── domain/               # Business logic & entities
│   │   │   ├── entities/
│   │   │   │   └── user_entity.dart
│   │   │   ├── repositories/
│   │   │   │   └── auth_repository.dart
│   │   │   └── usecases/
│   │   │       ├── login_usecase.dart
│   │   │       ├── register_usecase.dart
│   │   │       └── logout_usecase.dart
│   │   │
│   │   └── presentation/        # UI & providers
│   │       ├── providers/
│   │       │   └── auth_provider.dart
│   │       ├── pages/
│   │       │   ├── login_page.dart
│   │       │   └── register_page.dart
│   │       └── widgets/
│   │           ├── login_form.dart
│   │           └── register_form.dart
│   │
│   ├── home/                     # Home/Room list feature
│   │   ├── data/
│   │   │   ├── datasources/
│   │   │   │   └── room_datasource.dart
│   │   │   ├── models/
│   │   │   │   └── room_model.dart
│   │   │   └── repositories/
│   │   │       └── room_repository.dart
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   └── room_entity.dart
│   │   │   ├── repositories/
│   │   │   ├── usecases/
│   │   │   │   ├── get_rooms_usecase.dart
│   │   │   │   └── create_room_usecase.dart
│   │   │   └── params/
│   │   │       └── room_params.dart
│   │   └── presentation/
│   │       ├── providers/
│   │       │   └── room_provider.dart
│   │       ├── pages/
│   │       │   └── home_page.dart
│   │       └── widgets/
│   │           ├── room_list.dart
│   │           ├── room_item.dart
│   │           └── create_room_dialog.dart
│   │
│   ├── room/                     # Video call room feature
│   │   ├── data/
│   │   │   ├── datasources/
│   │   │   │   ├── room_datasource.dart
│   │   │   │   ├── socket_datasource.dart
│   │   │   │   └── webrtc_datasource.dart
│   │   │   ├── models/
│   │   │   │   ├── peer_model.dart
│   │   │   │   ├── offer_model.dart
│   │   │   │   └── ice_candidate_model.dart
│   │   │   └── repositories/
│   │   │       ├── room_repository.dart
│   │   │       ├── socket_repository.dart
│   │   │       └── webrtc_repository.dart
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── peer_entity.dart
│   │   │   │   └── call_stats_entity.dart
│   │   │   ├── repositories/
│   │   │   └── usecases/
│   │   │       ├── join_room_usecase.dart
│   │   │       ├── leave_room_usecase.dart
│   │   │       ├── toggle_camera_usecase.dart
│   │   │       └── toggle_audio_usecase.dart
│   │   └── presentation/
│   │       ├── providers/
│   │       │   ├── call_provider.dart
│   │       │   ├── webrtc_provider.dart
│   │       │   └── stats_provider.dart
│   │       ├── pages/
│   │       │   └── room_page.dart
│   │       └── widgets/
│   │           ├── video_grid.dart
│   │           ├── peer_video.dart
│   │           ├── local_video.dart
│   │           ├── call_controls.dart
│   │           ├── call_stats.dart
│   │           └── admin_controls.dart
│   │
│   ├── admin/                    # Admin panel feature
│   │   ├── data/
│   │   │   ├── datasources/
│   │   │   │   └── admin_datasource.dart
│   │   │   ├── models/
│   │   │   │   └── admin_action_model.dart
│   │   │   └── repositories/
│   │   │       └── admin_repository.dart
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── repositories/
│   │   │   └── usecases/
│   │   │       ├── disable_camera_usecase.dart
│   │   │       ├── mute_audio_usecase.dart
│   │   │       └── force_rejoin_usecase.dart
│   │   └── presentation/
│   │       ├── providers/
│   │       │   └── admin_provider.dart
│   │       ├── pages/
│   │       │   └── admin_panel_page.dart
│   │       └── widgets/
│   │           ├── admin_user_list.dart
│   │           ├── admin_controls_panel.dart
│   │           └── admin_statistics.dart
│   │
│   └── profile/                  # User profile feature
│       ├── data/
│       ├── domain/
│       └── presentation/
│
├── shared/                       # Shared resources
│   │
│   ├── services/                 # Global services
│   │   ├── api_service.dart      # Dio HTTP client setup
│   │   ├── socket_service.dart   # Socket.IO connection
│   │   ├── webrtc_service.dart   # WebRTC service
│   │   ├── storage_service.dart  # Secure storage
│   │   ├── notification_service.dart
│   │   └── permission_service.dart
│   │
│   ├── models/                   # Shared data models
│   │   ├── base_response.dart
│   │   ├── error_response.dart
│   │   └── pagination.dart
│   │
│   ├── widgets/                  # Reusable widgets
│   │   ├── app_button.dart
│   │   ├── app_text_field.dart
│   │   ├── app_dialog.dart
│   │   ├── app_snackbar.dart
│   │   ├── loading_indicator.dart
│   │   ├── error_widget.dart
│   │   └── empty_state_widget.dart
│   │
│   ├── theme/                    # App theme
│   │   ├── app_theme.dart        # Main theme
│   │   ├── app_colors.dart       # Color constants
│   │   ├── app_text_styles.dart  # Text styles
│   │   └── app_sizes.dart        # Size constants
│   │
│   ├── extensions/               # Dart extensions
│   │   ├── string_extension.dart
│   │   ├── context_extension.dart
│   │   ├── list_extension.dart
│   │   └── date_time_extension.dart
│   │
│   ├── utils/                    # Utility functions
│   │   ├── validators.dart       # Form validators
│   │   ├── formatters.dart       # Data formatters
│   │   ├── string_utils.dart
│   │   ├── date_utils.dart
│   │   └── app_utils.dart
│   │
│   ├── navigation/               # Navigation setup
│   │   ├── app_router.dart       # GoRouter configuration
│   │   └── routes.dart           # Route names
│   │
│   └── providers/                # Shared providers
│       ├── theme_provider.dart
│       └── notification_provider.dart
│
├── main.dart                     # App entry point
│
└── config/                       # Configurations
    ├── firebase_options.dart     # Firebase config (if needed)
    └── constants.dart            # Global constants
```

---

## 📁 Assets Folder Structure

```
assets/
├── images/                       # UI images
│   ├── logo/
│   │   ├── logo.png
│   │   └── logo_dark.png
│   ├── icons/
│   │   ├── camera_on.png
│   │   ├── camera_off.png
│   │   ├── mic_on.png
│   │   ├── mic_off.png
│   │   ├── speaker_on.png
│   │   └── speaker_off.png
│   ├── placeholders/
│   │   ├── no_video.png
│   │   └── loading.gif
│   └── backgrounds/
│       └── call_background.jpg
│
├── icons/                        # Icon sets
│   ├── svg/                      # SVG icons (for flutter_svg)
│   │   ├── call.svg
│   │   ├── end_call.svg
│   │   ├── settings.svg
│   │   └── admin.svg
│   └── png/                      # PNG icons (for multiple sizes)
│       ├── ic_24/
│       ├── ic_32/
│       └── ic_48/
│
├── fonts/                        # Custom fonts
│   ├── Roboto-Regular.ttf
│   └── Roboto-Bold.ttf
│
└── animations/                   # Lottie animations
    ├── loading.json
    └── connecting.json
```

---

## 🧪 Test Folder Structure

```
test/
│
├── unit/                         # Unit tests
│   ├── auth/
│   │   ├── data/
│   │   │   ├── repositories/
│   │   │   │   └── auth_repository_test.dart
│   │   │   └── datasources/
│   │   │       └── auth_datasource_test.dart
│   │   ├── domain/
│   │   │   └── usecases/
│   │   │       ├── login_usecase_test.dart
│   │   │       └── register_usecase_test.dart
│   │   └── presentation/
│   │       └── provider/
│   │           └── auth_provider_test.dart
│   │
│   ├── room/
│   └── helpers/
│       ├── test_helpers.dart
│       └── mock_data.dart
│
├── widget/                       # Widget tests
│   ├── auth/
│   │   ├── login_page_test.dart
│   │   └── register_page_test.dart
│   ├── room/
│   │   ├── room_page_test.dart
│   │   └── video_grid_test.dart
│   └── helpers/
│       └── test_widget_helper.dart
│
├── integration/                  # Integration tests
│   ├── auth_flow_test.dart
│   ├── call_flow_test.dart
│   └── helpers/
│       └── integration_helpers.dart
│
└── fixtures/                     # Test data & mocks
    ├── json/
    │   ├── login_response.json
    │   └── room_list_response.json
    └── mocks/
        ├── mock_api_client.dart
        └── mock_socket_client.dart
```

---

## 📋 Configuration Files

```
root/
├── pubspec.yaml                  # Dependencies
├── pubspec.lock                  # Lock file (auto-generated)
├── analysis_options.yaml         # Linter rules
├── .env                          # Environment variables
├── .env.example                  # Example env
├── .gitignore                    # Git ignore rules
├── .github/
│   └── workflows/                # CI/CD workflows
│       ├── lint.yml
│       ├── test.yml
│       └── build.yml
├── README.md                     # Project documentation
└── CHANGELOG.md                  # Version history
```

---

## 🏗️ Creating Folder Structure

### **Automated Script**

Buat file `create_structure.sh`:

```bash
#!/bin/bash

# Create lib structure
mkdir -p lib/core/{config,constants,providers,exceptions,logger}
mkdir -p lib/features/{auth,home,room,admin,profile}/{data/{datasources,models,repositories},domain/{entities,repositories,usecases,params},presentation/{providers,pages,widgets}}
mkdir -p lib/shared/{services,models,widgets,theme,extensions,utils,navigation,providers}
mkdir -p lib/config

# Create test structure
mkdir -p test/{unit/{auth,room,home,admin},widget/{auth,room},integration,fixtures/{json,mocks}}

# Create assets structure
mkdir -p assets/{images/{logo,icons,placeholders,backgrounds},icons/{svg,png/{ic_24,ic_32,ic_48}},fonts,animations}

# Create Android/iOS specific dirs (already created by Flutter)
# But you can customize them:
# mkdir -p android/app/src/main/kotlin/com/example/webrtc_app
# mkdir -p ios/Runner/GeneratedPluginRegistrant

echo "Folder structure created successfully!"
```

Run script:
```bash
chmod +x create_structure.sh
./create_structure.sh
```

### **Manual Creation**

Jika tidak bisa run script, buat manual:

```bash
cd lib
mkdir -p core/{config,constants,providers,exceptions,logger}
mkdir -p features/{auth,home,room,admin,profile}

# ... dan seterusnya sesuai struktur di atas
```

---

## 📊 File Organization Best Practices

### **Single Responsibility**
```dart
// ✅ GOOD: Separate concerns
// lib/shared/widgets/app_button.dart
class AppButton extends StatelessWidget { ... }

// ❌ BAD: Too many things in one file
// app_widgets.dart
class AppButton { ... }
class AppTextField { ... }
class AppDialog { ... }
```

### **Import Organization**
```dart
// ✅ GOOD: Organized imports
// 1. Dart imports
import 'dart:async';

// 2. Flutter imports
import 'package:flutter/material.dart';

// 3. Package imports
import 'package:provider/provider.dart';

// 4. Local imports
import '../../domain/entities/user_entity.dart';
import '../pages/home_page.dart';

// ❌ BAD: Random order
import 'model.dart';
import 'package:flutter/material.dart';
import 'dart:async';
import 'provider.dart';
```

### **File Naming Convention**
```
✅ GOOD:
- login_page.dart        # PascalCase for screens/pages
- app_button.dart        # snake_case for files
- user_entity.dart
- auth_provider.dart

❌ BAD:
- LoginPage.dart         # Wrong case
- AppButton.dart
- user.dart              # Too vague
- provider.dart          # Needs context
```

### **Class vs File Naming**
```dart
// ✅ File: login_page.dart
class LoginPage extends StatelessWidget { ... }

// ✅ File: app_button.dart
class AppButton extends StatelessWidget { ... }

// ✅ File: user_entity.dart
class UserEntity {
  final String id;
  final String name;
  // ...
}

// ✅ File: auth_repository.dart
abstract class AuthRepository {
  Future<void> login(String email, String password);
}

class AuthRepositoryImpl implements AuthRepository {
  // ...
}
```

---

## 🚀 Scaling the Structure

Saat aplikasi berkembang, struktur dapat di-scale:

### **Menambah feature baru**
```
features/
└── new_feature/
    ├── data/
    │   ├── datasources/
    │   ├── models/
    │   └── repositories/
    ├── domain/
    │   ├── entities/
    │   ├── repositories/
    │   └── usecases/
    └── presentation/
        ├── providers/
        ├── pages/
         └── widgets/
```

### **Menambah layer kompleks**
```
shared/
├── services/           # ← Layanan global
├── widgets/
├── theme/
├── utils/
├── models/
├── navigation/
├── local_db/           # ← Baru: Offline storage
├── firebase/           # ← Baru: Firebase integration
├── analytics/          # ← Baru: Analytics
└── error_handling/     # ← Baru: Global error handling
```

---

## 💾 .gitignore Setup

```
# Basics
.DS_Store
.dart_tool/
.flutter-plugins
.packages
.pub-cache/
.pub/
/build/

# Flutter
**/flutter/ephemeral/
**/flutter/.gradle/
**/Flutter/Flutter.framework
**/Flutter/Flutter.podspec
**/Flutter/Flutter-Release.podspec
**/Flutter/ios

# iOS/macOS
**/ios/**/*.mode1v3
**/ios/**/*.mode2v3
**/ios/**/*.moved-aside
**/ios/**/*.pbxuser
**/ios/**/*.perspectivev3
**/ios/**/*sync/
**/ios/**/.sconsign.dblite
**/ios/**/.tags*
**/ios/**/.vagrant/
**/ios/**/DerivedData/
**/ios/**/Icon?
**/ios/**/Pods/
**/ios/**/.symlinks/
**/ios/**/*.xcworkspace
**/macos/Flutter/Flutter-Release.podspec
**/macos/Flutter/ephemeral/

# Android
**/android/gradlew
**/android/gradlew.bat
**/android/.gradle/
**/android/captures/
**/android/gradlew.properties
**/android/**/GeneratedPluginRegistrant.java
**/android/key.properties
**/android/**/gradle-wrapper.jar

# Environment
.env
.env.*.local
.env.prod

# IDE
.vscode/
.idea/
*.swp
*.swo
*.sublime-project
*.sublime-workspace
*.iml

# Local files
*.log
*.swp
*.swo

# Generated files
lib/generated/

# Testing
coverage/

# Compiled binaries
*.deb
*.exe
*.dll
*.so
*.dylib
*.zip
*.tar.gz
```

---

## 🎯 Next Steps

1. ✅ Create this folder structure
2. 📖 Read `03-ARCHITECTURE_DESIGN.md` - Understand design patterns
3. 💻 Start adding files and code

---

**Last Updated**: March 17, 2025
**Status**: Complete
**Best Practices**: Flutter Clean Architecture

