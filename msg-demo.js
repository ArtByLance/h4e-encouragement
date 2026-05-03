import {
  buildEncouragementMessage,
  getDefaultEncouragementInputs,
  listEncouragementEvents,
  listEncouragementLocales,
} from "./msg-helper.js";

/**
 * Encouragement Message Demo Controller
 * =============================================================================
 *
 * Browser-only harness for validating the message catalog and helper behavior.
 * This file intentionally keeps all business logic in msg-helper.js so product,
 * QA, and engineering reviewers can use the demo as an integration reference
 * without mistaking it for production application code.
 */

// Centralize DOM lookups so render/update functions stay focused on state flow.
const dom = {
  nameInput: document.getElementById("nameInput"),
  phoneInput: document.getElementById("phoneInput"),
  localeSelect: document.getElementById("localeSelect"),
  eventSelect: document.getElementById("eventSelect"),
  generateButton: document.getElementById("generateButton"),
  messageOutput: document.getElementById("messageOutput"),
  payloadOutput: document.getElementById("payloadOutput"),
};

let catalog = null;
let selectedTemplateKey = "";

/**
 * Load the catalog beside the demo file. This requires an HTTP server because
 * browser fetch() calls are blocked for many file:// URLs.
 *
 * @returns {Promise<object>}
 */
async function loadCatalog() {
  const response = await fetch("./msg-data.json");

  if (!response.ok) {
    throw new Error(`Failed to load message catalog (HTTP ${response.status}).`);
  }

  return response.json();
}

/**
 * Populate event options from helper output rather than reading catalog.messages
 * directly. This keeps the demo aligned with the production integration API.
 */
function populateEventOptions() {
  dom.eventSelect.innerHTML = "";

  for (const event of listEncouragementEvents(catalog)) {
    const option = document.createElement("option");
    option.value = event.key;
    option.textContent = event.label;
    dom.eventSelect.appendChild(option);
  }
}

/**
 * Populate locale options, including text direction metadata used by previews.
 */
function populateLocaleOptions() {
  dom.localeSelect.innerHTML = "";

  for (const locale of listEncouragementLocales(catalog)) {
    const option = document.createElement("option");
    option.value = locale.key;
    option.textContent = locale.label;
    option.dataset.direction = locale.direction;
    dom.localeSelect.appendChild(option);
  }
}

/**
 * Seed controls with catalog-provided defaults for immediate smoke testing.
 */
function applyDefaults() {
  const defaults = getDefaultEncouragementInputs(catalog);

  dom.nameInput.value = defaults.recipientName;
  dom.phoneInput.value = defaults.phoneNumber;
  dom.localeSelect.value = defaults.locale;
  dom.eventSelect.value = defaults.eventKey;
}

/**
 * Resolve preview direction from the selected locale option.
 *
 * @param {string} localeKey
 * @returns {string}
 */
function getSelectedLocaleDirection(localeKey) {
  const selectedOption = Array.from(dom.localeSelect.options).find(
    (option) => option.value === localeKey
  );

  return selectedOption?.dataset.direction || "ltr";
}

/**
 * Render the current form state into both the human-readable message and the
 * structured payload. Keeping selectedTemplateKey between renders prevents text
 * inputs from unexpectedly rerolling the message variant.
 *
 * @param {{ rerollTemplate?: boolean }} [options]
 */
function renderOutput({ rerollTemplate = false } = {}) {
  try {
    if (rerollTemplate) {
      selectedTemplateKey = "";
    }

    const result = buildEncouragementMessage({
      catalog,
      eventKey: dom.eventSelect.value,
      locale: dom.localeSelect.value,
      recipientName: dom.nameInput.value,
      phoneNumber: dom.phoneInput.value,
      templateKey: selectedTemplateKey,
    });

    selectedTemplateKey = result.templateKey;
    dom.messageOutput.value = result.messageText;
    dom.messageOutput.dir = getSelectedLocaleDirection(result.resolvedLocale);
    dom.payloadOutput.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    dom.messageOutput.value = `Error: ${error.message}`;
    dom.messageOutput.dir = "ltr";
    dom.payloadOutput.textContent = "";
  }
}

/**
 * Force a new random template variant before rendering.
 */
function resetTemplateAndRender() {
  renderOutput({ rerollTemplate: true });
}

/**
 * Wire controls to either re-render the current template or reroll intentionally.
 */
function attachListeners() {
  dom.nameInput.addEventListener("input", renderOutput);
  dom.phoneInput.addEventListener("input", renderOutput);
  dom.localeSelect.addEventListener("change", resetTemplateAndRender);
  dom.eventSelect.addEventListener("change", resetTemplateAndRender);
  dom.generateButton.addEventListener("click", resetTemplateAndRender);
}

/**
 * Bootstrap the demo and show a practical local-file hint when fetch() cannot
 * load the catalog.
 */
async function initializeDemo() {
  try {
    catalog = await loadCatalog();
    populateLocaleOptions();
    populateEventOptions();
    applyDefaults();
    attachListeners();
    resetTemplateAndRender();
  } catch (error) {
    const isLocalFile = window.location.protocol === "file:";

    dom.messageOutput.value = isLocalFile
      ? "This demo must be served from a local server. Try: npx serve . or python -m http.server"
      : `Could not initialize demo: ${error.message}`;
    dom.payloadOutput.textContent = "";
  }
}

initializeDemo();
