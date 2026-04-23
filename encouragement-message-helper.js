/**
 * Shared helper for app integration.
 *
 * Expected usage:
 * 1. Load the JSON catalog.
 * 2. Pass the three runtime inputs into buildEncouragementMessage().
 * 3. Use the returned object directly in the app.
 */

const DEFAULT_NAME_PLACEHOLDER = "[Name]";

/**
 * @param {unknown} value
 * @returns {string}
 */
function toTrimmedString(value) {
  return String(value ?? "").trim();
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isObjectRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
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
 * @param {object} catalog
 * @param {string} eventKey
 * @returns {{ key: string, label: string, template: string }}
 */
function getMessageDefinition(catalog, eventKey) {
  if (!isObjectRecord(catalog) || !isObjectRecord(catalog.messages)) {
    throw new Error("Invalid message catalog.");
  }

  const cleanEventKey = toTrimmedString(eventKey);
  const definition = catalog.messages[cleanEventKey];

  if (!isObjectRecord(definition)) {
    throw new Error(`Unknown event key: "${cleanEventKey}"`);
  }

  const template = toTrimmedString(definition.template);
  const label = toTrimmedString(definition.label || definition.condition);

  if (!template) {
    throw new Error(`Missing template for event key: "${cleanEventKey}"`);
  }

  return {
    key: cleanEventKey,
    label: label || cleanEventKey,
    template,
  };
}

/**
 * @param {string} template
 * @param {string} placeholder
 * @returns {string}
 */
function stripNamePlaceholder(template, placeholder) {
  return template
    .replaceAll(`${placeholder}, `, "")
    .replaceAll(`${placeholder}!`, "")
    .replaceAll(`${placeholder}.`, "")
    .replaceAll(placeholder, "");
}

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeMessage(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/^\s*[,!.\-:;]+\s*/g, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

/**
 * Main app-facing helper.
 *
 * @param {object} params
 * @param {object} params.catalog
 * @param {string} params.eventKey
 * @param {string} [params.recipientName]
 * @param {string} [params.phoneNumber]
 * @returns {{
 *   eventKey: string,
 *   eventLabel: string,
 *   recipientName: string,
 *   phoneNumber: string,
 *   messageText: string
 * }}
 */
export function buildEncouragementMessage({
  catalog,
  eventKey,
  recipientName = "",
  phoneNumber = "",
}) {
  const definition = getMessageDefinition(catalog, eventKey);
  const cleanRecipientName = toTrimmedString(recipientName);
  const cleanPhoneNumber = toTrimmedString(phoneNumber);
  const placeholder = getNamePlaceholder(catalog);

  const rawMessage = cleanRecipientName
    ? definition.template.replaceAll(placeholder, cleanRecipientName)
    : stripNamePlaceholder(definition.template, placeholder);

  return {
    eventKey: definition.key,
    eventLabel: definition.label,
    recipientName: cleanRecipientName,
    phoneNumber: cleanPhoneNumber,
    messageText: normalizeMessage(rawMessage),
  };
}

/**
 * Small convenience for forms or demos.
 *
 * @param {object} catalog
 * @returns {{ recipientName: string, phoneNumber: string, eventKey: string }}
 */
export function getDefaultEncouragementInputs(catalog) {
  const defaults = isObjectRecord(catalog?.defaults) ? catalog.defaults : {};

  return {
    recipientName: toTrimmedString(defaults.recipientName || defaults.name),
    phoneNumber: toTrimmedString(defaults.phoneNumber || defaults.phone),
    eventKey: toTrimmedString(defaults.eventKey || defaults.event),
  };
}

/**
 * Small convenience for building a dropdown or admin picker.
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
    const definition = getMessageDefinition(catalog, eventKey);
    return {
      key: definition.key,
      label: definition.label,
    };
  });
}
