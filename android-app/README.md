# EcoTrack Android app

This is an isolated Android wrapper for the live EcoTrack platform. It does not replace or modify the web application.

## Current milestone

- Native Android launcher
- Loads https://ecotracksa.co.za over HTTPS
- Restricts in-app navigation to the EcoTrack domain
- Keeps JavaScript and DOM storage enabled for the existing web application
- Rejects invalid TLS certificates and blocks mixed content
- Builds a debug APK through GitHub Actions

## Build

From this directory, with JDK 17 and Gradle 8.9 installed:

```bash
gradle assembleDebug
```

APK output:

```
app/build/outputs/apk/debug/app-debug.apk
```

## Bluetooth roadmap

The native Bluetooth bridge is intentionally not enabled in this first shell. The next milestone is to implement Android BLE GATT scanning/connection and Bluetooth Classic SPP behind a narrow, origin-checked JavaScript bridge, then integrate it with the existing EcoTrack scale workflow. Scale-specific packet decoding and physical hardware tests will still be required.

## Important

This first APK requires an internet connection to load the hosted EcoTrack application. It is not an offline-capable version of EcoTrack. Debug builds are for testing and are not Play Store release builds.
