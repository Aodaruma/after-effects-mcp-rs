/* Premiere MCP Bridge (CEP) ExtendScript */

if (typeof JSON === "undefined") {
    JSON = {};
    JSON.stringify = function (obj) {
        return obj.toString();
    };
    JSON.parse = function () {
        return null;
    };
}

var mcpBridgeState = {
    autoRun: true,
    lastStatus: "idle",
    lastCommand: null,
    lastMessage: null,
    lastError: null,
    lastRunAt: null,
    bridgeRoot: null,
    commandFile: null,
    resultFile: null
};

function mcpBridgeRootFolder() {
    var docs = Folder.myDocuments;
    var root = new Folder(docs.fsName + "/pr-mcp-bridge");
    if (!root.exists) {
        root.create();
    }
    return root;
}

function mcpBridgeCommandFile() {
    var root = mcpBridgeRootFolder();
    return new File(root.fsName + "/pr_command.json");
}

function mcpBridgeResultFile() {
    var root = mcpBridgeRootFolder();
    return new File(root.fsName + "/pr_mcp_result.json");
}

function mcpBridgeGetState() {
    var root = mcpBridgeRootFolder();
    var cmd = mcpBridgeCommandFile();
    var res = mcpBridgeResultFile();
    mcpBridgeState.bridgeRoot = root.fsName;
    mcpBridgeState.commandFile = cmd.fsName;
    mcpBridgeState.resultFile = res.fsName;
    return JSON.stringify(mcpBridgeState);
}

function mcpBridgeSetAutoRun(enabled) {
    mcpBridgeState.autoRun = enabled === true;
    return mcpBridgeGetState();
}

function mcpExecuteCommand(command, args) {
    if (!command) {
        throw new Error("command is required");
    }
    var handler = $.global[command];
    if (typeof handler === "function") {
        return handler(args || {});
    }
    return JSON.stringify({
        status: "error",
        message: "Unknown command: " + command
    });
}

function mcpWriteResult(raw) {
    var resultFile = mcpBridgeResultFile();
    resultFile.open("w");
    resultFile.write(raw);
    resultFile.close();
}

function mcpUpdateCommandStatus(payload, status) {
    payload.status = status;
    var cmdFile = mcpBridgeCommandFile();
    cmdFile.open("w");
    cmdFile.write(JSON.stringify(payload, null, 2));
    cmdFile.close();
}

function mcpBridgeCheck() {
    try {
        if (!mcpBridgeState.autoRun) {
            return mcpBridgeGetState();
        }
        var cmdFile = mcpBridgeCommandFile();
        if (!cmdFile.exists) {
            mcpBridgeState.lastStatus = "waiting";
            return mcpBridgeGetState();
        }

        cmdFile.open("r");
        var content = cmdFile.read();
        cmdFile.close();
        if (!content) {
            mcpBridgeState.lastStatus = "waiting";
            return mcpBridgeGetState();
        }

        var payload = null;
        try {
            payload = JSON.parse(content);
        } catch (parseErr) {
            mcpBridgeState.lastStatus = "error";
            mcpBridgeState.lastError = "Invalid command JSON";
            return mcpBridgeGetState();
        }

        if (!payload || !payload.command) {
            mcpBridgeState.lastStatus = "waiting";
            return mcpBridgeGetState();
        }

        var status = payload.status || "";
        if (status.toLowerCase() !== "pending") {
            mcpBridgeState.lastStatus = "waiting";
            return mcpBridgeGetState();
        }

        var command = payload.command;
        var args = payload.args || {};
        var rawResult = "";
        try {
            rawResult = mcpExecuteCommand(command, args);
        } catch (err) {
            rawResult = JSON.stringify({
                status: "error",
                message: err.toString()
            });
        }

        var resultString = (typeof rawResult === "string")
            ? rawResult
            : JSON.stringify(rawResult);

        try {
            var resultObj = JSON.parse(resultString);
            if (resultObj) {
                resultObj._commandExecuted = command;
                resultObj._responseTimestamp = new Date().toISOString();
                resultString = JSON.stringify(resultObj, null, 2);
            }
        } catch (_e) {}

        mcpWriteResult(resultString);

        var finalStatus = "completed";
        try {
            var parsed = JSON.parse(resultString);
            if (parsed && parsed.status === "error") {
                finalStatus = "error";
            }
        } catch (_e2) {}

        mcpUpdateCommandStatus(payload, finalStatus);

        mcpBridgeState.lastStatus = finalStatus;
        mcpBridgeState.lastCommand = command;
        mcpBridgeState.lastMessage = "Executed command: " + command;
        mcpBridgeState.lastError = finalStatus === "error" ? "Command failed" : null;
        mcpBridgeState.lastRunAt = new Date().toISOString();
    } catch (err) {
        mcpBridgeState.lastStatus = "error";
        mcpBridgeState.lastError = err.toString();
    }

    return mcpBridgeGetState();
}

function ping(_args) {
    return JSON.stringify({
        status: "success",
        message: "ok"
    });
}
