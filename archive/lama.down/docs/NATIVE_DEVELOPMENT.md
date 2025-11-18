# Native Development Guide

Complete guide for iOS and Android native development with Expo and React Native.

## Overview

After running `npx expo prebuild`, you have native iOS and Android projects that you can build, run, and customize.

**Available Platforms:**
- ✅ iOS Simulators (20+ devices available)
- ⚠️ Android Emulator (needs setup - see below)

## Quick Start

### iOS (Recommended - Ready to Use)

```bash
# Run on iPhone 16 Pro simulator
npm run ios

# Or specify a device
npx expo run:ios --device "iPhone 16 Pro"

# List all available simulators
xcrun simctl list devices available | grep iPhone
```

### Android (Setup Required)

```bash
# Install Android Studio first, then:
npm run android

# Or specify an emulator
npx expo run:android --device Pixel_8_API_34
```

## iOS Development

### Available Simulators

Your system has these iOS simulators ready:

**iPhones:**
- iPhone 16 Pro / Pro Max / Plus
- iPhone 15 Pro / Pro Max / Plus
- iPhone SE (3rd generation)

**iPads:**
- iPad Pro (M4) 11" / 13"
- iPad Air (M2) 11" / 13"
- iPad (10th generation)
- iPad mini (6th generation)

### Running on Specific Device

```bash
# iPhone 16 Pro
npx expo run:ios --device "iPhone 16 Pro"

# iPad Pro
npx expo run:ios --device "iPad Pro 11-inch (M4)"

# Let Expo choose
npm run ios
```

### Opening in Xcode

```bash
# Open the workspace
open ios/lamaapp.xcworkspace

# Or from Finder
# Navigate to ios/ folder and double-click lamaapp.xcworkspace
```

### iOS Configuration

#### 1. App Display Name

Edit `ios/lamaapp/Info.plist`:
```xml
<key>CFBundleDisplayName</key>
<string>LAMA</string>
```

#### 2. Bundle Identifier

In Xcode:
1. Open `lamaapp.xcworkspace`
2. Select project in navigator
3. Under "General" → "Identity"
4. Change "Bundle Identifier" (e.g., `com.yourcompany.lama`)

#### 3. App Icon

Place your app icon assets in:
```
ios/lamaapp/Images.xcassets/AppIcon.appiconset/
```

Or use:
```bash
npx expo-icon-generator
```

#### 4. Splash Screen

Edit `ios/lamaapp/LaunchScreen.storyboard` in Xcode

#### 5. Permissions

Add to `ios/lamaapp/Info.plist`:
```xml
<!-- Camera Permission -->
<key>NSCameraUsageDescription</key>
<string>Allow LAMA to take photos for chat attachments</string>

<!-- Photo Library -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Allow LAMA to access photos for sharing</string>

<!-- Microphone -->
<key>NSMicrophoneUsageDescription</key>
<string>Allow LAMA to record audio messages</string>
```

### Build Configurations

Xcode supports multiple build configurations:

**Debug** (default for development):
- Faster builds
- Metro bundler connected
- Debugging enabled

**Release**:
- Optimized build
- No Metro bundler
- Production-ready

```bash
# Build for release
npx expo run:ios --configuration Release
```

### iOS Build Variants

Create custom schemes in Xcode:

1. **Development** - Uses dev API
2. **Staging** - Uses staging API
3. **Production** - Uses production API

To set this up:
1. Open Xcode
2. Product → Scheme → Manage Schemes
3. Duplicate existing scheme
4. Rename (e.g., "lama-staging")
5. Edit scheme → Build Configuration → Choose/Create

### Code Signing

For development:
- Automatic signing works fine
- Xcode → Signing & Capabilities → Team (select your Apple ID)

For distribution:
- Need Apple Developer account ($99/year)
- Create provisioning profiles
- Configure in Xcode signing settings

### Common iOS Issues

**Metro bundler not connecting:**
```bash
# Clear cache and rebuild
npm run start:clear
npx expo run:ios
```

**Pod install fails:**
```bash
cd ios
pod deintegrate
pod install
cd ..
```

**Build errors after dependencies:**
```bash
# Clean build
cd ios
xcodebuild clean
cd ..
npm run ios
```

## Android Development

### Setup Required

#### 1. Install Android Studio

Download from: https://developer.android.com/studio

#### 2. Install Android SDK

In Android Studio:
1. Open "SDK Manager"
2. Install:
   - Android SDK Platform 34 (API 34)
   - Android SDK Build-Tools
   - Android Emulator
   - Android SDK Platform-Tools

#### 3. Set Environment Variables

Add to `~/.zshrc` or `~/.bash_profile`:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

Reload:
```bash
source ~/.zshrc
```

#### 4. Create Android Virtual Device (AVD)

In Android Studio:
1. Tools → Device Manager
2. Create Device
3. Choose: Pixel 8 (recommended)
4. System Image: API 34 (UpsideDownCake)
5. Finish

### Running on Android

```bash
# Start emulator first
emulator -avd Pixel_8_API_34

# Then run app
npm run android

# Or let Expo start emulator
npx expo run:android
```

### Opening in Android Studio

```bash
# Open Android Studio
open -a "Android Studio" android

# Or from Android Studio
# File → Open → Select android/ folder
```

### Android Configuration

#### 1. App Name

Edit `android/app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">LAMA</string>
```

#### 2. Package Name

In `android/app/build.gradle`:
```gradle
android {
    namespace "com.yourcompany.lama"
    // ...
}
```

Also update:
- `android/app/src/main/AndroidManifest.xml`
- Move Java/Kotlin files to new package structure

#### 3. App Icon

Place icons in:
```
android/app/src/main/res/
  ├── mipmap-hdpi/
  ├── mipmap-mdpi/
  ├── mipmap-xhdpi/
  ├── mipmap-xxhdpi/
  └── mipmap-xxxhdpi/
```

#### 4. Splash Screen

Edit `android/app/src/main/res/values/colors.xml` and `styles.xml`

#### 5. Permissions

In `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

### Android Build Variants

Edit `android/app/build.gradle`:

```gradle
android {
    // ...

    buildTypes {
        debug {
            applicationIdSuffix ".debug"
            debuggable true
        }

        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }

        staging {
            initWith debug
            applicationIdSuffix ".staging"
            manifestPlaceholders = [appName: "LAMA Staging"]
        }
    }

    flavorDimensions "environment"
    productFlavors {
        dev {
            dimension "environment"
            applicationIdSuffix ".dev"
        }

        prod {
            dimension "environment"
        }
    }
}
```

Build specific variant:
```bash
# Dev debug
npx expo run:android --variant devDebug

# Prod release
npx expo run:android --variant prodRelease
```

### Release Build

#### Generate Signing Key

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 \
  -keystore lama-release-key.keystore \
  -alias lama-key-alias \
  -keyalg RSA -keysize 2048 -validity 10000
```

#### Configure Signing

Create `android/gradle.properties`:
```properties
MYAPP_RELEASE_STORE_FILE=lama-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=lama-key-alias
MYAPP_RELEASE_STORE_PASSWORD=your-password
MYAPP_RELEASE_KEY_PASSWORD=your-password
```

Edit `android/app/build.gradle`:
```gradle
android {
    signingConfigs {
        release {
            storeFile file(MYAPP_RELEASE_STORE_FILE)
            storePassword MYAPP_RELEASE_STORE_PASSWORD
            keyAlias MYAPP_RELEASE_KEY_ALIAS
            keyPassword MYAPP_RELEASE_KEY_PASSWORD
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

#### Build Release APK

```bash
cd android
./gradlew assembleRelease
```

APK location:
```
android/app/build/outputs/apk/release/app-release.apk
```

#### Build Release Bundle (for Play Store)

```bash
cd android
./gradlew bundleRelease
```

Bundle location:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Common Android Issues

**Gradle sync failed:**
```bash
cd android
./gradlew clean
cd ..
```

**Metro bundler not connecting:**
```bash
adb reverse tcp:8081 tcp:8081
npm start
```

**App crashes on startup:**
- Check logs: `npx react-native log-android`
- Clear app data on emulator
- Rebuild: `npm run android`

## Development Workflow

### Hot Reload

Changes to JavaScript/TypeScript automatically reload:

1. **Fast Refresh** - Preserves component state
2. **Full Reload** - Shake device or press `r` in Metro

### Debugging

#### React Native Debugger

```bash
# Install
brew install react-native-debugger

# Run
open "rndebugger://set-debugger-loc?host=localhost&port=8081"
```

#### Chrome DevTools

1. Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android)
2. Select "Debug"
3. Opens Chrome with DevTools

#### Flipper

```bash
# Install
brew install flipper

# Run
flipper
```

Features:
- Network inspector
- Layout inspector
- Crash reporter
- Redux DevTools

### Performance Profiling

#### iOS Instruments

```bash
# Profile with Instruments
open ios/lamaapp.xcworkspace
# Product → Profile (Cmd+I)
```

#### Android Profiler

In Android Studio:
- View → Tool Windows → Profiler
- Run app and start profiling

### Testing on Physical Devices

#### iOS Device

1. Connect iPhone/iPad via USB
2. Trust computer on device
3. In Xcode, select device from dropdown
4. Run (Cmd+R)

Or via CLI:
```bash
npx expo run:ios --device
```

#### Android Device

1. Enable Developer Options on device
2. Enable USB Debugging
3. Connect via USB
4. Run:
```bash
adb devices  # Verify device connected
npm run android
```

## Build for Distribution

### iOS App Store

1. **Archive in Xcode**:
   - Product → Archive
   - Wait for build to complete

2. **Upload to App Store Connect**:
   - Window → Organizer
   - Select archive → Distribute App
   - Follow wizard

3. **TestFlight** (Beta Testing):
   - Automatic after upload
   - Add testers in App Store Connect

### Android Play Store

1. **Build AAB**:
   ```bash
   cd android
   ./gradlew bundleRelease
   ```

2. **Upload to Play Console**:
   - Visit play.google.com/console
   - Create app
   - Upload AAB
   - Fill out store listing

3. **Internal Testing**:
   - Create internal test track
   - Add testers via email

## Environment-Specific Configuration

### Using Environment Variables

Install:
```bash
npm install react-native-dotenv
```

Create `.env.development`, `.env.staging`, `.env.production`:
```env
API_URL=https://api.dev.example.com
API_KEY=dev_key_123
```

Usage:
```typescript
import { API_URL } from '@env';

const api = new API(API_URL);
```

### Build-Time Configuration

Create `app.config.js`:
```javascript
const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_STAGING = process.env.APP_VARIANT === 'staging';

export default {
  name: IS_STAGING ? 'LAMA Staging' : 'LAMA',
  slug: 'lama',
  // ... rest of config
  extra: {
    apiUrl: IS_DEV
      ? 'https://api.dev.example.com'
      : IS_STAGING
      ? 'https://api.staging.example.com'
      : 'https://api.example.com',
  },
};
```

## Performance Optimization

### Bundle Size

```bash
# Analyze bundle
npx react-native-bundle-visualizer

# Enable Hermes (already enabled in app.json)
# Reduces bundle size by ~30%
```

### Native Optimizations

#### iOS

In Xcode:
- Build Settings → Optimization Level → "Fastest, Smallest [-Os]"
- Build Settings → Strip Debug Symbols → Yes

#### Android

In `android/app/build.gradle`:
```gradle
android {
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt')
        }
    }
}
```

## Continuous Integration

### GitHub Actions Example

`.github/workflows/ios.yml`:
```yaml
name: iOS Build

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npx expo prebuild
      - run: cd ios && pod install
      - run: xcodebuild -workspace ios/lamaapp.xcworkspace \
             -scheme lamaapp -configuration Release \
             -sdk iphonesimulator build
```

## Troubleshooting

### Reset Everything

```bash
# Clean all build artifacts
rm -rf ios/build android/app/build
rm -rf node_modules
npm install

# Regenerate native projects
npx expo prebuild --clean

# iOS: Clean pods
cd ios
pod deintegrate && pod install
cd ..

# Start fresh
npm run start:clear
```

### Common Errors

**"No bundle URL present"** (iOS):
- Metro bundler not running
- Solution: `npm start` then rebuild

**"Unable to load script"** (Android):
- Metro bundler can't connect
- Solution: `adb reverse tcp:8081 tcp:8081`

**Native module errors**:
- Rebuild native code
- iOS: `cd ios && pod install`
- Android: `cd android && ./gradlew clean`

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Xcode Documentation](https://developer.apple.com/xcode/)
- [Android Studio Guide](https://developer.android.com/studio/intro)

## Next Steps

1. ✅ Native projects generated
2. ⏳ Set up Android emulator (if needed)
3. ⏳ Configure app icons and splash screens
4. ⏳ Set up signing for distribution
5. ⏳ Configure CI/CD pipeline
