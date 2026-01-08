# Capacitor Implementation Plan for Zenote

**Version:** 1.0
**Last Updated:** 2026-01-08
**Status:** Ready to Implement
**Author:** Claude (Opus 4.5)

---

## Overview

Wrap Zenote PWA in Capacitor to create native iOS and Android apps. This preserves 100% of the existing React codebase while enabling native distribution and features.

### Goals

1. Build native iOS app (runs on iPhone/iPad)
2. Build native Android app (runs on phones/tablets)
3. Improve iOS install experience (no Safari instructions)
4. Enable future native features (widgets, share extensions)
5. **Optional:** App Store / Play Store distribution

### What Changes

| Aspect | Before | After |
|--------|--------|-------|
| Codebase | React PWA | Same React code, wrapped |
| iOS distribution | Safari "Add to Home" | Native app |
| Android distribution | Chrome install prompt | Native app or APK |
| Bundle size | ~332KB web | ~5-10MB native |
| Updates | Instant (web) | Can use live updates or store |

---

## Prerequisites

### Required Software

| Tool | Purpose | Install |
|------|---------|---------|
| **Node.js 18+** | Already have | - |
| **Xcode 15+** | iOS builds | Mac App Store (free) |
| **Android Studio** | Android builds | [developer.android.com](https://developer.android.com/studio) (free) |
| **CocoaPods** | iOS dependencies | `sudo gem install cocoapods` |
| **JDK 17** | Android builds | Usually bundled with Android Studio |

### Hardware Requirements

- **iOS development:** Requires macOS (Xcode only runs on Mac)
- **Android development:** Windows, macOS, or Linux

### Account Requirements (by distribution method)

| Distribution | Apple Account | Google Account | Cost |
|--------------|---------------|----------------|------|
| **Personal device only** | Free Apple ID | Free Google account | $0 |
| **TestFlight (iOS beta)** | Apple Developer | - | $99/year |
| **App Store** | Apple Developer | - | $99/year |
| **Play Store** | - | Google Play Developer | $25 one-time |
| **APK sideload (Android)** | - | Free | $0 |

---

## Implementation Steps

### Phase 1: Project Setup (30 minutes)

#### 1.1 Install Capacitor

```bash
# Install Capacitor CLI and core
npm install @capacitor/core @capacitor/cli

# Initialize Capacitor in the project
npx cap init Zenote com.zenote.app --web-dir dist
```

This creates `capacitor.config.ts`:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zenote.app',
  appName: 'Zenote',
  webDir: 'dist',
  server: {
    // For development: load from Vite dev server
    // url: 'http://localhost:5173',
    // cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#1a1f1a', // Dark theme background
  },
};

export default config;
```

#### 1.2 Add Native Platforms

```bash
# Add iOS platform
npm install @capacitor/ios
npx cap add ios

# Add Android platform
npm install @capacitor/android
npx cap add android
```

This creates:
- `ios/` - Xcode project
- `android/` - Android Studio project

#### 1.3 Build and Sync

```bash
# Build web assets
npm run build

# Copy web assets to native projects
npx cap sync
```

**Add to package.json scripts:**

```json
{
  "scripts": {
    "cap:sync": "npm run build && npx cap sync",
    "cap:ios": "npm run build && npx cap sync ios && npx cap open ios",
    "cap:android": "npm run build && npx cap sync android && npx cap open android"
  }
}
```

---

### Phase 2: iOS Configuration (1-2 hours)

#### 2.1 Open Xcode Project

```bash
npx cap open ios
```

#### 2.2 Configure App Icons

Create app icons at these sizes (or use an icon generator):

| Size | Usage |
|------|-------|
| 20x20, 40x40, 60x60 | Notification |
| 29x29, 58x58, 87x87 | Settings |
| 40x40, 80x80, 120x120 | Spotlight |
| 60x60, 120x120, 180x180 | App icon |
| 1024x1024 | App Store |

**Tool:** Use [appicon.co](https://appicon.co/) to generate all sizes from a single 1024x1024 image.

Place in: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

#### 2.3 Configure Launch Screen

Edit `ios/App/App/Base.lproj/LaunchScreen.storyboard` or replace with a simple splash:

```xml
<!-- Simple centered logo approach -->
<!-- Or use Capacitor Splash Screen plugin -->
```

**Alternative:** Use `@capacitor/splash-screen` plugin for more control.

#### 2.4 Configure Info.plist

Edit `ios/App/App/Info.plist` to add:

```xml
<!-- App Transport Security (if needed) -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
</dict>

<!-- Status bar style -->
<key>UIStatusBarStyle</key>
<string>UIStatusBarStyleLightContent</string>

<!-- Supported orientations -->
<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>
```

#### 2.5 Run on Simulator

1. In Xcode, select a simulator (e.g., iPhone 15 Pro)
2. Click the Play button (or Cmd+R)
3. App should launch in simulator

#### 2.6 Run on Physical Device (Free)

1. Connect iPhone via USB
2. In Xcode: Select your device as target
3. Xcode will prompt to sign with your Apple ID
4. On iPhone: Settings → General → VPN & Device Management → Trust your developer certificate
5. Click Play to install

**Limitation:** Free signing expires after 7 days. Re-run from Xcode to refresh.

---

### Phase 3: Android Configuration (1 hour)

#### 3.1 Open Android Studio Project

```bash
npx cap open android
```

#### 3.2 Configure App Icons

Android uses adaptive icons (foreground + background layers):

| Resource | Size | Location |
|----------|------|----------|
| ic_launcher.png | 48x48 to 192x192 | `android/app/src/main/res/mipmap-*` |
| ic_launcher_foreground.png | 108x108 to 432x432 | Adaptive icon foreground |
| ic_launcher_background.png | 108x108 to 432x432 | Adaptive icon background |

**Tool:** Android Studio → Right-click `res` → New → Image Asset

#### 3.3 Configure Splash Screen

Edit `android/app/src/main/res/values/styles.xml`:

```xml
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="android:background">@color/splash_background</item>
</style>
```

Add color in `android/app/src/main/res/values/colors.xml`:

```xml
<color name="splash_background">#1a1f1a</color>
```

#### 3.4 Configure AndroidManifest.xml

Edit `android/app/src/main/AndroidManifest.xml`:

```xml
<application
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:supportsRtl="true"
    android:theme="@style/AppTheme">

    <!-- Internet permission (already included) -->
    <uses-permission android:name="android.permission.INTERNET" />
</application>
```

#### 3.5 Run on Emulator

1. In Android Studio: Tools → Device Manager → Create Virtual Device
2. Select a device (e.g., Pixel 7)
3. Download a system image (e.g., API 34)
4. Click Play to run

#### 3.6 Run on Physical Device (Free)

1. On Android phone: Settings → About → Tap "Build number" 7 times to enable Developer Options
2. Settings → Developer Options → Enable USB Debugging
3. Connect via USB, accept debugging prompt
4. In Android Studio, select your device and click Play

#### 3.7 Build APK for Sharing (Free)

```bash
cd android
./gradlew assembleDebug
```

APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

Share this APK file directly - recipients can install by enabling "Install from unknown sources."

---

### Phase 4: Native Plugins (Optional)

#### 4.1 Splash Screen

```bash
npm install @capacitor/splash-screen
npx cap sync
```

```typescript
// App.tsx or main.tsx
import { SplashScreen } from '@capacitor/splash-screen';

// Hide splash when app is ready
SplashScreen.hide();
```

#### 4.2 Status Bar

```bash
npm install @capacitor/status-bar
npx cap sync
```

```typescript
import { StatusBar, Style } from '@capacitor/status-bar';

// Match Zenote's dark theme
StatusBar.setStyle({ style: Style.Dark });
StatusBar.setBackgroundColor({ color: '#1a1f1a' });
```

#### 4.3 Haptics

```bash
npm install @capacitor/haptics
npx cap sync
```

```typescript
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Replace navigator.vibrate() with native haptics
Haptics.impact({ style: ImpactStyle.Light });
```

#### 4.4 Share (Receive shared content - iOS)

```bash
npm install @capacitor/share
npx cap sync
```

For iOS Share Extension (receive content from other apps), additional native code is required. This is more complex - consider as a future enhancement.

---

### Phase 5: App Store Distribution (Requires $99/year)

#### 5.1 Apple Developer Program

1. Enroll at [developer.apple.com](https://developer.apple.com/programs/enroll/)
2. Pay $99/year
3. Wait for approval (usually 24-48 hours)

#### 5.2 Create App Store Connect Entry

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. My Apps → "+" → New App
3. Fill in:
   - Platform: iOS
   - Name: Zenote
   - Primary Language: English
   - Bundle ID: com.zenote.app
   - SKU: zenote-001

#### 5.3 Archive and Upload

1. In Xcode: Product → Archive
2. Window → Organizer → Distribute App
3. Select "App Store Connect"
4. Upload

#### 5.4 Submit for Review

1. In App Store Connect, complete:
   - Screenshots (6.7" and 5.5" required)
   - Description, keywords, support URL
   - Privacy policy URL
   - Age rating questionnaire
2. Submit for Review
3. Wait 24-48 hours (typically)

---

### Phase 6: Play Store Distribution (Requires $25 one-time)

#### 6.1 Google Play Developer Account

1. Sign up at [play.google.com/console](https://play.google.com/console)
2. Pay $25 one-time fee
3. Complete identity verification

#### 6.2 Build Release APK/AAB

```bash
cd android

# Generate signing key (once)
keytool -genkey -v -keystore zenote-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias zenote

# Build release bundle
./gradlew bundleRelease
```

Configure signing in `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            storeFile file('zenote-release-key.jks')
            storePassword 'your-password'
            keyAlias 'zenote'
            keyPassword 'your-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

#### 6.3 Create Play Store Listing

1. All apps → Create app
2. Fill in:
   - App name: Zenote
   - Default language: English
   - App or game: App
   - Free or paid: Free
3. Complete store listing:
   - Short description (80 chars)
   - Full description (4000 chars)
   - Screenshots, feature graphic
   - Privacy policy URL

#### 6.4 Upload and Publish

1. Release → Production → Create new release
2. Upload AAB file
3. Complete content rating questionnaire
4. Review and rollout

---

## Development Workflow

### Daily Development

```bash
# Start Vite dev server
npm run dev

# In capacitor.config.ts, uncomment:
# server: { url: 'http://YOUR_IP:5173', cleartext: true }

# Sync and run on device (hot reload works!)
npx cap run ios --livereload --external
npx cap run android --livereload --external
```

### Testing Builds

```bash
# Full production build test
npm run build
npx cap sync
npx cap run ios
npx cap run android
```

### Updating Native Projects

After changing Capacitor config or plugins:

```bash
npx cap sync
```

---

## File Structure After Setup

```
zenote/
├── ios/                      # Xcode project (gitignore: ios/App/Pods/)
│   ├── App/
│   │   ├── App/
│   │   │   ├── Assets.xcassets/  # App icons
│   │   │   ├── Info.plist        # iOS configuration
│   │   │   └── ...
│   │   └── App.xcworkspace       # Open this in Xcode
│   └── ...
├── android/                  # Android Studio project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── res/              # Icons, colors, strings
│   │   │   ├── AndroidManifest.xml
│   │   │   └── ...
│   │   └── build.gradle
│   └── ...
├── capacitor.config.ts       # Capacitor configuration
├── src/                      # Your React code (unchanged)
├── dist/                     # Built web assets
└── ...
```

---

## Checklist

### Phase 1: Setup
- [ ] Install Capacitor packages
- [ ] Run `npx cap init`
- [ ] Add iOS platform
- [ ] Add Android platform
- [ ] Add npm scripts
- [ ] First `cap sync` successful

### Phase 2: iOS
- [ ] Open in Xcode
- [ ] Configure app icons
- [ ] Configure launch screen
- [ ] Run on simulator
- [ ] Run on physical device
- [ ] Test all features work

### Phase 3: Android
- [ ] Open in Android Studio
- [ ] Configure app icons
- [ ] Configure splash screen
- [ ] Run on emulator
- [ ] Run on physical device
- [ ] Build debug APK
- [ ] Test APK installation

### Phase 4: Polish
- [ ] Add Splash Screen plugin
- [ ] Add Status Bar plugin
- [ ] Replace navigator.vibrate with Haptics
- [ ] Test offline functionality
- [ ] Test deep links (if applicable)

### Phase 5: Distribution (Optional)
- [ ] Apple Developer enrollment ($99/year)
- [ ] App Store Connect setup
- [ ] iOS screenshots
- [ ] iOS App Store submission
- [ ] Google Play Developer enrollment ($25)
- [ ] Play Store listing
- [ ] Android release build
- [ ] Play Store submission

---

## Cost Summary

| Item | Free Tier | Paid Tier |
|------|-----------|-----------|
| Development | ✅ Full | - |
| iOS Simulator | ✅ Full | - |
| Android Emulator | ✅ Full | - |
| Personal iOS device | ✅ 7-day signing | $99/yr unlimited |
| Personal Android device | ✅ Full | - |
| Android APK sharing | ✅ Unlimited | - |
| iOS TestFlight | ❌ | $99/yr |
| App Store | ❌ | $99/yr |
| Play Store | ❌ | $25 one-time |

**Minimum to start:** $0 (develop, test on your devices, share Android APKs)

**For full distribution:** $124 first year, $99/year ongoing

---

## Troubleshooting

### iOS: "No signing certificate"
- Use free Apple ID signing for development
- Xcode → Signing & Capabilities → Team → Add Account → Use Personal Team

### iOS: App crashes on launch
- Check Xcode console for errors
- Common: Missing Info.plist keys, incorrect bundle ID

### Android: "SDK not found"
- Set ANDROID_HOME environment variable
- Android Studio → SDK Manager → Copy SDK path

### Android: Gradle build fails
- Try: `cd android && ./gradlew clean`
- Check Java version: `java -version` (need JDK 17)

### Both: Web content not updating
- Run `npx cap sync` after every `npm run build`
- Clear app data/reinstall if caching issues

---

## Next Steps

1. **Start with Phase 1-3** (free, ~3 hours)
2. **Test thoroughly** on your devices
3. **Decide on distribution** based on your goals
4. **Optional:** Add native plugins for enhanced UX

Ready to implement? Start with:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init Zenote com.zenote.app --web-dir dist
```
