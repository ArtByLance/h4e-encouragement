/**
 * Encouragement Message Helper
 * =============================================================================
 *
 * Production-facing utility for turning a message catalog entry into the final
 * text and payload an application can send, preview, or log.
 *
 * Public API:
 * - buildEncouragementMessage(): resolve event + locale + template into output.
 * - getDefaultEncouragementInputs(): read catalog-provided demo/form defaults.
 * - listEncouragementLocales(): expose locale labels and text directions.
 * - listEncouragementEvents(): expose stable event keys in catalog order.
 *
 * Catalog contract:
 * - Runtime logic should use stable message keys, not human-readable labels.
 * - Templates are grouped by locale and named template1, template2, etc.
 * - The configured defaultLocale is the fallback when a requested locale is
 *   missing for a specific event.
 * - {{recipientName}} is the canonical placeholder. Legacy [Name] templates are
 *   still understood so older catalogs can be migrated safely.
 *
 * Error behavior:
 * - Invalid catalogs, unknown events, missing templates, and unknown template
 *   keys fail fast with descriptive Error messages.
 */

const DEFAULT_LOCALE = "en";
const DEFAULT_NAME_PLACEHOLDER = "{{recipientName}}";
const LEGACY_NAME_PLACEHOLDER = "[Name]";
const TEMPLATE_KEY_PATTERN = /^template(\d+)$/;

/**
 * Convert optional app/catalog input into a normalized scalar string.
 *
 * @param {unknown} value
 * @returns {string}
 */
function toTrimmedString(value) {
  return String(value ?? "").trim();
}

/**
 * Narrow loose JSON values to plain object-like records.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isObjectRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Resolve the configured recipient-name token, preserving a project-wide
 * default when older or partial catalogs omit placeholder metadata.
 *
 * @param {object} catalog
 * @returns {string}
 */
function getNamePlaceholder(catalog) {
  return (
    toTrimmedString(catalog?.placeholders?.recipientName) ||
    DEFAULT_NAME_PLACEHOLDER
  );
}

/**
 * Resolve the default locale used for initial state and template fallback.
 *
 * @param {object} catalog
 * @returns {string}
 */
function getDefaultLocale(catalog) {
  return toTrimmedString(catalog?.defaultLocale) || DEFAULT_LOCALE;
}

/**
 * Treat an empty locale input as a request for the catalog default.
 *
 * @param {object} catalog
 * @param {string} locale
 * @returns {string}
 */
function normalizeLocale(catalog, locale) {
  return toTrimmedString(locale) || getDefaultLocale(catalog);
}

/**
 * Return supported locales with the default locale guaranteed to be present.
 *
 * @param {object} catalog
 * @returns {Array<string>}
 */
function getSupportedLocales(catalog) {
  const locales = Array.isArray(catalog?.supportedLocales)
    ? catalog.supportedLocales.map((locale) => toTrimmedString(locale)).filter(Boolean)
    : [];

  const defaultLocale = getDefaultLocale(catalog);
  return locales.includes(defaultLocale) ? locales : [defaultLocale, ...locales];
}

/**
 * Collect template records from either the current locale-keyed object shape or
 * the legacy flat array/object shape. Object keys are sorted numerically so
 * template10 never appears before template2.
 *
 * @param {object} templates
 * @returns {Array<{ key: string, text: string }>}
 */
function collectTemplateEntries(templates) {
  if (Array.isArray(templates)) {
    return templates
      .map((text, index) => ({
        key: `template${index + 1}`,
        text: toTrimmedString(text),
      }))
      .filter((template) => Boolean(template.text));
  }

  if (!isObjectRecord(templates)) {
    return [];
  }

  return Object.keys(templates)
    .filter((key) => TEMPLATE_KEY_PATTERN.test(key))
    .sort((left, right) => {
      const leftNumber = Number(left.match(TEMPLATE_KEY_PATTERN)?.[1] || 0);
      const rightNumber = Number(right.match(TEMPLATE_KEY_PATTERN)?.[1] || 0);
      return leftNumber - rightNumber;
    })
    .map((templateKey) => ({
      key: templateKey,
      text: toTrimmedString(templates[templateKey]),
    }))
    .filter((template) => Boolean(template.text));
}

/**
 * Normalize legacy v1 templates into the v2 placeholder convention.
 *
 * @param {object} definition
 * @returns {Array<{ key: string, text: string }>}
 */
function collectLegacyTemplateEntries(definition) {
  return collectTemplateEntries(definition).map((template) => ({
    ...template,
    text: template.text.replaceAll(LEGACY_NAME_PLACEHOLDER, DEFAULT_NAME_PLACEHOLDER),
  }));
}

/**
 * Resolve the complete message definition for an event and locale.
 *
 * This function owns the catalog compatibility rules: v2 catalogs resolve
 * templates by requested locale, then defaultLocale; v1 catalogs read flat
 * template fields and resolve as English.
 *
 * @param {object} catalog
 * @param {string} eventKey
 * @param {string} locale
 * @returns {{
 *   key: string,
 *   label: string,
 *   requestedLocale: string,
 *   resolvedLocale: string,
 *   templates: Array<{ key: string, text: string }>
 * }}
 */
function getMessageDefinition(catalog, eventKey, locale = getDefaultLocale(catalog)) {
  if (!isObjectRecord(catalog) || !isObjectRecord(catalog.messages)) {
    throw new Error("Invalid message catalog.");
  }

  const cleanEventKey = toTrimmedString(eventKey);
  const requestedLocale = normalizeLocale(catalog, locale);
  const fallbackLocale = getDefaultLocale(catalog);
  const definition = catalog.messages[cleanEventKey];

  if (!isObjectRecord(definition)) {
    throw new Error(`Unknown event key: "${cleanEventKey}"`);
  }

  const label = toTrimmedString(definition.label || definition.condition);
  let resolvedLocale = requestedLocale;
  let templates = [];

  if (isObjectRecord(definition.templates)) {
    templates = collectTemplateEntries(definition.templates[requestedLocale]);

    if (!templates.length && requestedLocale !== fallbackLocale) {
      templates = collectTemplateEntries(definition.templates[fallbackLocale]);
      resolvedLocale = fallbackLocale;
    }
  } else {
    templates = collectLegacyTemplateEntries(definition);
    resolvedLocale = DEFAULT_LOCALE;
  }

  if (!templates.length) {
    throw new Error(
      `Missing template for event key: "${cleanEventKey}" and locale: "${requestedLocale}"`
    );
  }

  return {
    key: cleanEventKey,
    label: label || cleanEventKey,
    requestedLocale,
    resolvedLocale,
    templates,
  };
}

/**
 * Choose a template variant for organic message rotation.
 *
 * @param {Array<{ key: string, text: string }>} templates
 * @returns {{ key: string, text: string }}
 */
function selectRandomTemplate(templates) {
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Select a deterministic template when callers pass templateKey; otherwise
 * rotate randomly within the resolved locale.
 *
 * @param {Array<{ key: string, text: string }>} templates
 * @param {string} templateKey
 * @returns {{ key: string, text: string }}
 */
function selectTemplate(templates, templateKey) {
  const cleanTemplateKey = toTrimmedString(templateKey);

  if (!cleanTemplateKey) {
    return selectRandomTemplate(templates);
  }

  const template = templates.find((candidate) => candidate.key === cleanTemplateKey);

  if (!template) {
    throw new Error(`Unknown template key: "${cleanTemplateKey}"`);
  }

  return template;
}

/**
 * Build the placeholder set accepted during replacement.
 *
 * The configured placeholder comes first, followed by canonical and legacy
 * aliases. The Set avoids double work when a catalog already uses the default.
 *
 * @param {string} placeholder
 * @returns {Array<string>}
 */
function getRecipientNamePlaceholders(placeholder) {
  return Array.from(
    new Set([
      toTrimmedString(placeholder) || DEFAULT_NAME_PLACEHOLDER,
      DEFAULT_NAME_PLACEHOLDER,
      LEGACY_NAME_PLACEHOLDER,
    ])
  );
}

/**
 * Remove recipient placeholders when the caller has no recipient name.
 *
 * This keeps messages sendable for previews, QA, and anonymous flows without
 * leaking raw template syntax.
 *
 * @param {string} template
 * @param {Array<string>} placeholders
 * @returns {string}
 */
function stripNamePlaceholder(template, placeholders) {
  return placeholders.reduce(
    (message, placeholder) =>
      message
        .replaceAll(`${placeholder}, `, "")
        .replaceAll(`${placeholder}، `, "")
        .replaceAll(`${placeholder}!`, "")
        .replaceAll(`${placeholder}.`, "")
        .replaceAll(placeholder, ""),
    template
  );
}

/**
 * Replace every accepted recipient placeholder with the supplied name.
 *
 * @param {string} template
 * @param {Array<string>} placeholders
 * @param {string} recipientName
 * @returns {string}
 */
function replaceNamePlaceholder(template, placeholders, recipientName) {
  return placeholders.reduce(
    (message, placeholder) => message.replaceAll(placeholder, recipientName),
    template
  );
}

/**
 * Clean whitespace and punctuation left behind after placeholder handling.
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeMessage(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/^\s*[,،!.\-:;]+\s*/g, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

/**
 * Build the final message and integration payload for one event.
 *
 * Call this from application code after loading msg-data.json. The returned
 * payload is intentionally explicit: requestedLocale preserves caller intent,
 * resolvedLocale shows the locale actually used after fallback, and templateKey
 * records the selected variant for logs, QA, or deterministic re-rendering.
 *
 * @param {object} params
 * @param {object} params.catalog Message catalog loaded from msg-data.json.
 * @param {string} params.eventKey Stable key from catalog.messages.
 * @param {string} [params.locale] Requested locale. Defaults to catalog.defaultLocale.
 * @param {string} [params.recipientName] Optional display name for personalization.
 * @param {string} [params.phoneNumber] Optional phone number included for caller payloads.
 * @param {string} [params.templateKey] Optional template key for deterministic selection.
 * @returns {{
 *   eventKey: string,
 *   requestedLocale: string,
 *   resolvedLocale: string,
 *   recipientName: string,
 *   phoneNumber: string,
 *   templateKey: string,
 *   messageText: string
 * }}
 */
export function buildEncouragementMessage({
  catalog,
  eventKey,
  locale,
  recipientName = "",
  phoneNumber = "",
  templateKey = "",
}) {
  const definition = getMessageDefinition(catalog, eventKey, locale);
  const cleanRecipientName = toTrimmedString(recipientName);
  const cleanPhoneNumber = toTrimmedString(phoneNumber);
  const placeholder = getNamePlaceholder(catalog);
  const placeholders = getRecipientNamePlaceholders(placeholder);
  const selectedTemplate = selectTemplate(definition.templates, templateKey);

  const rawMessage = cleanRecipientName
    ? replaceNamePlaceholder(selectedTemplate.text, placeholders, cleanRecipientName)
    : stripNamePlaceholder(selectedTemplate.text, placeholders);

  return {
    eventKey: definition.key,
    requestedLocale: definition.requestedLocale,
    resolvedLocale: definition.resolvedLocale,
    recipientName: cleanRecipientName,
    phoneNumber: cleanPhoneNumber,
    templateKey: selectedTemplate.key,
    messageText: normalizeMessage(rawMessage),
  };
}

/**
 * Read default demo/form inputs from the catalog.
 *
 * These defaults are convenience values for previews and smoke tests; production
 * callers should still pass real runtime values into buildEncouragementMessage().
 *
 * @param {object} catalog
 * @returns {{ recipientName: string, phoneNumber: string, eventKey: string, locale: string }}
 */
export function getDefaultEncouragementInputs(catalog) {
  const defaults = isObjectRecord(catalog?.defaults) ? catalog.defaults : {};

  return {
    recipientName: toTrimmedString(defaults.recipientName || defaults.name),
    phoneNumber: toTrimmedString(defaults.phoneNumber || defaults.phone),
    eventKey: toTrimmedString(defaults.eventKey || defaults.event),
    locale: normalizeLocale(catalog, defaults.locale),
  };
}

/**
 * List locales in supportedLocales order with display metadata.
 *
 * Text direction is included so UI callers can render right-to-left previews
 * correctly without duplicating catalog knowledge.
 *
 * @param {object} catalog
 * @returns {Array<{ key: string, label: string, direction: string }>}
 */
export function listEncouragementLocales(catalog) {
  return getSupportedLocales(catalog).map((localeKey) => {
    const metadata = isObjectRecord(catalog?.locales?.[localeKey])
      ? catalog.locales[localeKey]
      : {};

    return {
      key: localeKey,
      label: toTrimmedString(metadata.label) || localeKey,
      direction: toTrimmedString(metadata.direction) || "ltr",
    };
  });
}

/**
 * List message events in business-defined catalog order.
 *
 * messageOrder lets product/admin teams control picker order without changing
 * stable event keys or reshaping the messages object.
 *
 * @param {object} catalog
 * @returns {Array<{ key: string, label: string }>}
 */
export function listEncouragementEvents(catalog) {
  if (!isObjectRecord(catalog) || !isObjectRecord(catalog.messages)) {
    throw new Error("Invalid message catalog.");
  }

  const preferredOrder = Array.isArray(catalog.messageOrder)
    ? catalog.messageOrder.map((value) => toTrimmedString(value)).filter(Boolean)
    : [];

  const orderedKeys = [
    ...preferredOrder,
    ...Object.keys(catalog.messages).filter((key) => !preferredOrder.includes(key)),
  ];

  return orderedKeys.map((eventKey) => {
    const definition = getMessageDefinition(catalog, eventKey, getDefaultLocale(catalog));
    return {
      key: definition.key,
      label: definition.label,
    };
  });
}
