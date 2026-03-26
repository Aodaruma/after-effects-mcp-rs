(function () {
  var autoRunCheckbox = document.getElementById("autoRun");
  var statusEl = document.getElementById("status");
  var bridgeRootEl = document.getElementById("bridgeRoot");
  var commandFileEl = document.getElementById("commandFile");
  var resultFileEl = document.getElementById("resultFile");
  var logEl = document.getElementById("log");
  var autoRun = true;

  function evalScript(script, callback) {
    if (window.__adobe_cep__ && window.__adobe_cep__.evalScript) {
      window.__adobe_cep__.evalScript(script, callback || function () {});
    } else if (callback) {
      callback("");
    }
  }

  function updateState(raw) {
    if (!raw) {
      return;
    }
    var state;
    try {
      state = JSON.parse(raw);
    } catch (e) {
      statusEl.textContent = "Invalid state";
      return;
    }
    if (typeof state.autoRun === "boolean") {
      autoRun = state.autoRun;
      autoRunCheckbox.checked = autoRun;
    }
    statusEl.textContent = state.lastStatus || "idle";
    bridgeRootEl.textContent = state.bridgeRoot || "-";
    commandFileEl.textContent = state.commandFile || "-";
    resultFileEl.textContent = state.resultFile || "-";

    var logLines = [];
    if (state.lastCommand) {
      logLines.push("Last command: " + state.lastCommand);
    }
    if (state.lastMessage) {
      logLines.push(state.lastMessage);
    }
    if (state.lastError) {
      logLines.push("Error: " + state.lastError);
    }
    if (state.lastRunAt) {
      logLines.push("Last run: " + state.lastRunAt);
    }
    logEl.textContent = logLines.length ? logLines.join("\n") : "Waiting for commands...";
  }

  function pollOnce() {
    if (autoRun) {
      evalScript("mcpBridgeCheck()", updateState);
    } else {
      evalScript("mcpBridgeGetState()", updateState);
    }
  }

  autoRunCheckbox.addEventListener("change", function () {
    autoRun = autoRunCheckbox.checked;
    evalScript("mcpBridgeSetAutoRun(" + (autoRun ? "true" : "false") + ")", updateState);
  });

  function init() {
    evalScript("mcpBridgeGetState()", updateState);
    window.setInterval(pollOnce, 1000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
