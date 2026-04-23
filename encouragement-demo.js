import {
  buildEncouragementMessage,
  getDefaultEncouragementInputs,
  listEncouragementEvents,
} from "./encouragement-message-helper.js";

const dom = {
  nameInput: document.getElementById("nameInput"),
  phoneInput: document.getElementById("phoneInput"),
  eventSelect: document.getElementById("eventSelect"),
  messageOutput: document.getElementById("messageOutput"),
  payloadOutput: document.getElementById("payloadOutput"),
};

let catalog = null;

async function loadCatalog() {
  const response = await fetch("./encouragement-messages.json");

  if (!response.ok) {
    throw new Error(`Failed to load message catalog (HTTP ${response.status}).`);
  }

  return response.json();
}

function populateEventOptions() {
  dom.eventSelect.innerHTML = "";

  for (const event of listEncouragementEvents(catalog)) {
    const option = document.createElement("option");
    option.value = event.key;
    option.textContent = event.label;
    dom.eventSelect.appendChild(option);
  }
}

function applyDefaults() {
  const defaults = getDefaultEncouragementInputs(catalog);

  dom.nameInput.value = defaults.recipientName;
  dom.phoneInput.value = defaults.phoneNumber;
  dom.eventSelect.value = defaults.eventKey;
}

function renderOutput() {
  try {
    const result = buildEncouragementMessage({
      catalog,
      eventKey: dom.eventSelect.value,
      recipientName: dom.nameInput.value,
      phoneNumber: dom.phoneInput.value,
    });

    dom.messageOutput.value = result.messageText;
    dom.payloadOutput.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    dom.messageOutput.value = `Error: ${error.message}`;
    dom.payloadOutput.textContent = "";
  }
}

function attachListeners() {
  dom.nameInput.addEventListener("input", renderOutput);
  dom.phoneInput.addEventListener("input", renderOutput);
  dom.eventSelect.addEventListener("change", renderOutput);
}

async function initializeDemo() {
  try {
    catalog = await loadCatalog();
    populateEventOptions();
    applyDefaults();
    attachListeners();
    renderOutput();
  } catch (error) {
    const isLocalFile = window.location.protocol === "file:";

    dom.messageOutput.value = isLocalFile
      ? "This demo must be served from a local server. Try: npx serve . or python -m http.server"
      : `Could not initialize demo: ${error.message}`;
    dom.payloadOutput.textContent = "";
  }
}

initializeDemo();
