import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEncouragementMessage,
  listEncouragementLocales,
} from "../msg-helper.js";

const v1Catalog = {
  placeholders: {
    recipientName: "[Name]",
  },
  messages: {
    inactive_3_days: {
      label: "Inactive 3 Days",
      template1: "[Name], it has been a few days.",
      active: true,
    },
  },
};

const v2Catalog = {
  schemaVersion: "2.0.0",
  defaultLocale: "en",
  supportedLocales: ["en", "es", "ar"],
  locales: {
    en: { label: "English", direction: "ltr" },
    es: { label: "Spanish", direction: "ltr" },
    ar: { label: "Arabic", direction: "rtl" },
  },
  placeholders: {
    recipientName: "{{recipientName}}",
  },
  messages: {
    inactive_3_days: {
      label: "Inactive 3 Days",
      active: true,
      templates: {
        en: {
          template1: "{{recipientName}}, it has been a few days.",
          template2: "Come back today, {{recipientName}}.",
        },
        es: {
          template1: "{{recipientName}}, han pasado unos dias.",
        },
        ar: {
          template1: "{{recipientName}}، مرت بضعة ايام.",
        },
      },
    },
  },
};

test("builds messages from the legacy v1 flat template shape", () => {
  const result = buildEncouragementMessage({
    catalog: v1Catalog,
    eventKey: "inactive_3_days",
    locale: "es",
    recipientName: "Mike",
  });

  assert.equal(result.messageText, "Mike, it has been a few days.");
  assert.equal(result.requestedLocale, "es");
  assert.equal(result.resolvedLocale, "en");
  assert.equal(result.templateKey, "template1");
});

test("builds v2 English, Spanish, and Arabic messages", () => {
  assert.equal(
    buildEncouragementMessage({
      catalog: v2Catalog,
      eventKey: "inactive_3_days",
      locale: "en",
      recipientName: "Mike",
      templateKey: "template1",
    }).messageText,
    "Mike, it has been a few days."
  );

  assert.equal(
    buildEncouragementMessage({
      catalog: v2Catalog,
      eventKey: "inactive_3_days",
      locale: "es",
      recipientName: "Mike",
      templateKey: "template1",
    }).messageText,
    "Mike, han pasado unos dias."
  );

  const arabic = buildEncouragementMessage({
    catalog: v2Catalog,
    eventKey: "inactive_3_days",
    locale: "ar",
    recipientName: "Mike",
    templateKey: "template1",
  });

  assert.equal(arabic.resolvedLocale, "ar");
  assert.equal(arabic.messageText, "Mike، مرت بضعة ايام.");
});

test("falls back to English when a requested locale is missing", () => {
  const result = buildEncouragementMessage({
    catalog: {
      ...v2Catalog,
      messages: {
        inactive_3_days: {
          ...v2Catalog.messages.inactive_3_days,
          templates: {
            en: v2Catalog.messages.inactive_3_days.templates.en,
          },
        },
      },
    },
    eventKey: "inactive_3_days",
    locale: "es",
    recipientName: "Mike",
    templateKey: "template1",
  });

  assert.equal(result.requestedLocale, "es");
  assert.equal(result.resolvedLocale, "en");
  assert.equal(result.messageText, "Mike, it has been a few days.");
});

test("uses explicit templateKey deterministically", () => {
  const result = buildEncouragementMessage({
    catalog: v2Catalog,
    eventKey: "inactive_3_days",
    locale: "en",
    recipientName: "Mike",
    templateKey: "template2",
  });

  assert.equal(result.templateKey, "template2");
  assert.equal(result.messageText, "Come back today, Mike.");
  assert.equal(Object.hasOwn(result, "eventLabel"), false);
});

test("random selection only chooses templates from the resolved locale", () => {
  for (let index = 0; index < 20; index += 1) {
    const result = buildEncouragementMessage({
      catalog: v2Catalog,
      eventKey: "inactive_3_days",
      locale: "es",
      recipientName: "Mike",
    });

    assert.equal(result.resolvedLocale, "es");
    assert.equal(result.templateKey, "template1");
    assert.equal(result.messageText, "Mike, han pasado unos dias.");
  }
});

test("does not leave unresolved placeholders in final message text", () => {
  const result = buildEncouragementMessage({
    catalog: v2Catalog,
    eventKey: "inactive_3_days",
    locale: "en",
    templateKey: "template1",
  });

  assert.doesNotMatch(result.messageText, /{{.+?}}|\[Name\]/);
  assert.equal(result.messageText, "it has been a few days.");

  const arabic = buildEncouragementMessage({
    catalog: v2Catalog,
    eventKey: "inactive_3_days",
    locale: "ar",
    templateKey: "template1",
  });

  assert.doesNotMatch(arabic.messageText, /{{.+?}}|\[Name\]/);
  assert.equal(arabic.messageText, "مرت بضعة ايام.");
});

test("lists locale labels and directions from catalog metadata", () => {
  assert.deepEqual(listEncouragementLocales(v2Catalog), [
    { key: "en", label: "English", direction: "ltr" },
    { key: "es", label: "Spanish", direction: "ltr" },
    { key: "ar", label: "Arabic", direction: "rtl" },
  ]);
});
