---
name: flutter-notification-generator
description: Generates push (Firebase Cloud Messaging) and local notification setup — permission handling, token registration, foreground/background handlers, channels. Use to add notifications to the app.
version: 1.0.0
category: frontend
tags:
  - flutter
  - notifications
  - fcm
  - push
model: inherit
invokes:
  - flutter-senior-programmer
inputs:
  - notification_requirements
outputs:
  - flutter_notifications
---

# Goal
Produce notification infrastructure: FCM setup (permission request, token retrieval/registration, message handlers) and `flutter_local_notifications` for foreground display and scheduled/local alerts.

# Inputs
```yaml
notification_requirements:
  push:
    provider: fcm
    topics: [order_updates, promos]
    register_token_to: apiClient.registerDevice
  local:
    channels:
      - { id: reminders, name: "Reminders", importance: high }
    scheduled: [cart_abandonment_reminder]
```

# Output
```yaml
flutter_notifications:
  files:
    - lib/core/notifications/push_service.dart
    - lib/core/notifications/local_notification_service.dart
    - lib/core/notifications/notification_channels.dart
```

# Workflow
## Step 1 — Permissions
Request notification permission (iOS/Android 13+) and expose the granted status.

## Step 2 — Push (FCM)
Retrieve the FCM token, register it via the API client, subscribe to topics, and wire foreground/`onBackgroundMessage`/tap handlers.

## Step 3 — Local
Configure `flutter_local_notifications` channels, show foreground pushes, and schedule local notifications.

## Step 4 — Implement
Delegate service bodies to `flutter-senior-programmer`; note required native (iOS/Android manifest) config.

# Rules
- Device-token registration uses the `flutter-api-client-generator` output; do not build ad-hoc HTTP here.
- Foreground FCM messages must be re-presented via local notifications (FCM does not auto-display in foreground).
- Flutter-only; web push (service worker) is out of scope and handled elsewhere.

# Examples
Input:
```yaml
notification_requirements: { push: { provider: fcm, topics: [order_updates] } }
```
Output:
```yaml
flutter_notifications:
  files:
    - lib/core/notifications/push_service.dart
    - lib/core/notifications/local_notification_service.dart
    - lib/core/notifications/notification_channels.dart
```
```dart
// lib/core/notifications/push_service.dart (abridged)
class PushService {
  PushService(this._fcm, this._api);
  final FirebaseMessaging _fcm;
  final ApiClient _api;
  Future<void> init() async {
    await _fcm.requestPermission();
    final token = await _fcm.getToken();
    if (token != null) await _api.registerDevice(token);
    await _fcm.subscribeToTopic('order_updates');
    FirebaseMessaging.onMessage.listen(_showForeground);
  }
}
```
