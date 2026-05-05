# Encouragement Messaging

Production-ready message catalog and helper utilities for generating attendee encouragement messages from stable event keys, locale-aware templates, and runtime personalization inputs.

## Files

- `msg-data.json` is the runtime message catalog consumed by applications and demos.
- `msg-helper.js` is the app-facing helper for resolving event, locale, template, and recipient data into a final message payload.
- `msg-demo.html` and `msg-demo.js` provide a browser preview harness for product, QA, and integration review.
- `worksheets/msg-templates-04-may-2026.xlsx` is the current approved multilingual workbook consumed by the import script.
- `worksheets/old/` contains archived source and prototype workbook versions.
- `scripts/create-prototype-multilingual-workbook.py` can build a multilingual workbook from the single-sheet source.
- `scripts/import-encouragement-workbook.py` converts the workbook into `msg-data.json`.
- `tests/` contains helper and import coverage.

## Catalog Contract

`msg-data.json` is intentionally clean JSON. JSON does not support comments, so durable maintenance guidance lives in this README and runtime metadata stays inside the catalog.

Required top-level concepts:

- `schemaVersion`: Version of the catalog shape. Current value is `2.0.0`.
- `catalogId`: Stable identifier for this catalog.
- `catalogName`: Human-readable catalog name.
- `description`: Concise runtime description for reviewers and tooling.
- `defaultLocale`: Locale used when no locale is provided or when an event lacks the requested locale.
- `supportedLocales`: Ordered list of locales exposed to callers.
- `locales`: Display metadata for each locale, including text direction.
- `placeholders`: Canonical placeholder tokens used by templates.
- `defaults`: Demo and smoke-test defaults.
- `messageOrder`: Product-defined event ordering for dropdowns and admin views.
- `messages`: Event definitions keyed by stable event keys.

## Message Definitions

Each entry under `messages` represents a stable triggerable event.

Expected fields:

- `label`: Short human-readable name for UI and review.
- `triggerDescription`: Plain-language trigger condition for operations and QA.
- `active`: Boolean flag for whether the event is intended to be used.
- `templates`: Locale-keyed template collections.

Template keys should use the `templateN` convention:

```json
{
  "templates": {
    "en": {
      "template1": "{{recipientName}}, welcome back.",
      "template2": "Good to see you again, {{recipientName}}."
    }
  }
}
```

Use stable event keys in code. Treat labels and descriptions as editable display copy.

## Locale Behavior

Callers may request any locale, but message generation resolves through this policy:

1. Use the requested locale when templates exist for that event.
2. Fall back to `defaultLocale` when the requested locale is unavailable.
3. Throw a descriptive error when no usable templates exist.

The generated payload includes both `requestedLocale` and `resolvedLocale` so integrations can log fallback behavior without guessing.

## Placeholder Policy

Use `{{recipientName}}` for recipient personalization.

When `recipientName` is provided, the helper replaces the placeholder in the selected template. When no name is provided, the helper removes the placeholder and normalizes leftover punctuation so previews and anonymous flows do not leak template syntax.

Legacy `[Name]` placeholders are still supported by `msg-helper.js` for backward compatibility, but new catalog content should use `{{recipientName}}`.

## Helper API

Primary integration:

```js
import { buildEncouragementMessage } from "./msg-helper.js";

const result = buildEncouragementMessage({
  catalog,
  eventKey: "inactive_3_days",
  locale: "es",
  recipientName: "Mike",
  phoneNumber: "678-777-7100",
});
```

Returned payload:

```json
{
  "eventKey": "inactive_3_days",
  "requestedLocale": "es",
  "resolvedLocale": "es",
  "recipientName": "Mike",
  "phoneNumber": "678-777-7100",
  "templateKey": "template1",
  "messageText": "Mike, han pasado unos dias."
}
```

Supporting helpers:

- `getDefaultEncouragementInputs(catalog)` reads demo/form defaults.
- `listEncouragementLocales(catalog)` returns locale labels and text direction.
- `listEncouragementEvents(catalog)` returns event keys and labels in `messageOrder`.

## Editing Workflow

Preferred content workflow:

1. Edit approved multilingual copy in `worksheets/msg-templates-04-may-2026.xlsx`.
2. Run the import script to regenerate `msg-data.json`.
3. Review the generated catalog diff.
4. Run tests.
5. Open the demo from a local server and smoke-test core events/locales.

Current workbook note: English, Spanish, and Arabic rows are marked `approved`, so the stricter production import can run without `--include-unapproved`.

Useful commands:

```sh
python3 scripts/import-encouragement-workbook.py worksheets/msg-templates-04-may-2026.xlsx -o msg-data.json
node --test tests/msg-helper.test.mjs
python3 -m unittest tests/test_import_encouragement_workbook.py
python3 -m http.server 8000
```

Then open `http://localhost:8000/msg-demo.html`.

## Review Checklist

Before handing off or shipping catalog changes:

- Every active event has English, Spanish, and Arabic templates.
- Each locale has the same approved template keys for a given event.
- All templates use `{{recipientName}}` consistently.
- `messageOrder` includes every event that should appear in UI pickers.
- Labels are short and readable.
- Trigger descriptions are specific enough for QA and operations.
- Generated payloads show expected `requestedLocale`, `resolvedLocale`, and `templateKey`.
- Arabic previews render right-to-left in the demo.

## JSON Metadata Guidance

Keep runtime metadata in `msg-data.json` when applications or tools may reasonably consume it. Examples include `schemaVersion`, `catalogId`, `defaultLocale`, `supportedLocales`, `locales`, `placeholders`, and `defaults`.

Keep process documentation outside JSON. Editing instructions, ownership notes, QA policy, and integration examples belong in Markdown so they do not bloat runtime payloads or drift into pseudo-comments.
