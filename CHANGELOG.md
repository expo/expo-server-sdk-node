# Changelog

## [3.15.0](https://github.com/expo/expo-server-sdk-node/compare/expo-server-sdk-v3.14.0...expo-server-sdk-v3.15.0) (2025-04-09)


### Features

* add categoryId and mutableContent fields to ExpoPushMessage ([#41](https://github.com/expo/expo-server-sdk-node/issues/41)) ([ae47d59](https://github.com/expo/expo-server-sdk-node/commit/ae47d59484526127cbfced84b37e1f03d381411f))
* add exponential backoff and retries for push/send ([#52](https://github.com/expo/expo-server-sdk-node/issues/52)) ([4dfde3b](https://github.com/expo/expo-server-sdk-node/commit/4dfde3bbf4aa313ff45036ea2a0d0fd32d2d18f0))
* add typings for icon and image support ([#147](https://github.com/expo/expo-server-sdk-node/issues/147)) ([dfa7156](https://github.com/expo/expo-server-sdk-node/commit/dfa7156c7239d43d040698fe15e1a90f98fda187))
* support custom sounds ([#110](https://github.com/expo/expo-server-sdk-node/issues/110)) ([131a4d0](https://github.com/expo/expo-server-sdk-node/commit/131a4d0fcb7250907f3d565a50cab98066282409))
* support interruptionLevel for iOS ([#106](https://github.com/expo/expo-server-sdk-node/issues/106)) ([07bbb73](https://github.com/expo/expo-server-sdk-node/commit/07bbb73cdefce1ff0bfddf9b1187b4dae216208e))


### Bug Fixes

* add missing request body type ([#102](https://github.com/expo/expo-server-sdk-node/issues/102)) ([88ed8fb](https://github.com/expo/expo-server-sdk-node/commit/88ed8fbfc1345f13911d8a8d30a5d8009aaa8892))
* invalid URL error when using expo-server-sdk inside API routes ([#128](https://github.com/expo/expo-server-sdk-node/issues/128)) ([8d9b75f](https://github.com/expo/expo-server-sdk-node/commit/8d9b75f5a673c79df4fb4175ea5c508943f3a425))
* **types:** move expoPushToken to ExpoPushErrorReceipt details ([#97](https://github.com/expo/expo-server-sdk-node/issues/97)) ([b3074b0](https://github.com/expo/expo-server-sdk-node/commit/b3074b0f5874e0a2a52a52c6ae1dd7f2b9a60cc4))
* typo in README.md file ([c590847](https://github.com/expo/expo-server-sdk-node/commit/c590847fb1203f416a53ab14a1bfe1c8e1fe7ca8))
* useFcmV1 should default to true and be deprecated ([#76](https://github.com/expo/expo-server-sdk-node/issues/76)) ([bca438d](https://github.com/expo/expo-server-sdk-node/commit/bca438da83d34e77dafadaa6bcb6c9f529075b8b))
