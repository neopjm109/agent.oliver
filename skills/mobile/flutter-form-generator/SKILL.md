---
name: flutter-form-generator
description: Generates Flutter forms with validation (flutter_form_builder or Form/TextFormField) from form specs, wired to Riverpod submit handlers. Use for login, checkout, and data-entry forms.
version: 1.0.0
category: frontend
tags:
  - flutter
  - forms
  - validation
  - input
model: inherit
invokes:
  - flutter-senior-programmer
inputs:
  - form_specs
outputs:
  - flutter_forms
---

# Goal
Produce Flutter form widgets with per-field validation, controlled state, and submit handlers that call Riverpod notifiers.

# Inputs
```yaml
form_specs:
  - name: login_form
    fields:
      - { name: email, type: email, required: true }
      - { name: password, type: password, required: true, min: 8 }
    submit: authProvider.login
  - name: checkout_form
    fields:
      - { name: address, type: text, required: true }
      - { name: zip, type: number, pattern: "\\d{5}" }
```

# Workflow
## Step 1 — Fields
Map each spec field to a `FormBuilderTextField`/`TextFormField` with the right keyboard type and obscure flag.

## Step 2 — Validation
Attach validators (required, min length, email, regex) using `FormBuilderValidators` or custom `validator` callbacks.

## Step 3 — Submit
On valid submit, call the referenced Riverpod notifier method; surface async errors inline.

## Step 4 — Implement
Delegate the form widget bodies to `flutter-senior-programmer`.

# Output
```yaml
flutter_forms:
  files:
    - lib/features/auth/login_form.dart
    - lib/features/checkout/checkout_form.dart
```

# Rules
- Validation runs on submit and (optionally) on change; disable submit while an async action is in flight.
- Forms invoke state via `flutter-state-generator` providers; they do not call the API client directly.
- Flutter-only; React forms are produced by `web/*` and are not reused.

# Examples
Input:
```yaml
form_specs: [ { name: login_form, fields: [ { name: email, type: email, required: true }, { name: password, type: password, required: true } ], submit: authProvider.login } ]
```
Output:
```yaml
flutter_forms:
  files:
    - lib/features/auth/login_form.dart
```
```dart
// lib/features/auth/login_form.dart (abridged)
class LoginForm extends ConsumerStatefulWidget {
  const LoginForm({super.key});
  @override
  ConsumerState<LoginForm> createState() => _LoginFormState();
}
class _LoginFormState extends ConsumerState<LoginForm> {
  final _key = GlobalKey<FormBuilderState>();
  @override
  Widget build(BuildContext context) => FormBuilder(
    key: _key,
    child: Column(children: [
      FormBuilderTextField(
        name: 'email',
        validator: FormBuilderValidators.compose([
          FormBuilderValidators.required(),
          FormBuilderValidators.email(),
        ]),
      ),
      FormBuilderTextField(
        name: 'password',
        obscureText: true,
        validator: FormBuilderValidators.required(),
      ),
      FilledButton(
        onPressed: () {
          if (_key.currentState!.saveAndValidate()) {
            final v = _key.currentState!.value;
            ref.read(authProvider.notifier).login(v['email'], v['password']);
          }
        },
        child: const Text('Sign in'),
      ),
    ]),
  );
}
```
