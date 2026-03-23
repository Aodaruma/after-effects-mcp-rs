use anyhow::{anyhow, Context, Result};
use bridge_core::BridgeClient;
use mcp_core::{
    effects_help_text, general_help_text, prompt_messages, prompt_specs, tool_specs, AppConfig,
};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::fs;
use std::time::Duration;
use tokio::io::{
    AsyncBufRead, AsyncBufReadExt, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader,
};
use tracing::{debug, error, info};

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    #[allow(dead_code)]
    jsonrpc: Option<String>,
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Value,
}

pub async fn run_stdio_server(cfg: AppConfig) -> Result<()> {
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();
    let mut reader = BufReader::new(stdin);
    let mut writer = stdout;
    let bridge = BridgeClient::new(cfg.clone())?;

    info!("MCP stdio server started");

    while let Some(message) = read_jsonrpc_message(&mut reader).await? {
        debug!("received message: {}", message);
        let response = match serde_json::from_value::<JsonRpcRequest>(message.clone()) {
            Ok(req) => handle_request(&cfg, &bridge, req).await,
            Err(e) => Some(error_response(
                Value::Null,
                -32700,
                format!("invalid request payload: {e}"),
            )),
        };

        if let Some(payload) = response {
            write_jsonrpc_message(&mut writer, &payload).await?;
        }
    }

    info!("stdio stream closed");
    Ok(())
}

async fn handle_request(
    cfg: &AppConfig,
    bridge: &BridgeClient,
    req: JsonRpcRequest,
) -> Option<Value> {
    let Some(id) = req.id.clone() else {
        if req.method.starts_with("notifications/") || req.method == "initialized" {
            return None;
        }
        return None;
    };

    let result = match req.method.as_str() {
        "initialize" => Ok(json!({
            "protocolVersion": "2025-06-18",
            "serverInfo": {
                "name": "AfterEffectsServer",
                "version": env!("CARGO_PKG_VERSION")
            },
            "capabilities": {
                "tools": { "listChanged": false },
                "resources": { "listChanged": false, "subscribe": false },
                "prompts": { "listChanged": false }
            }
        })),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(tools_list_result()),
        "tools/call" => tools_call_result(cfg, bridge, &req.params),
        "resources/list" => Ok(resources_list_result()),
        "resources/read" => resources_read_result(cfg, bridge, &req.params),
        "prompts/list" => Ok(prompts_list_result()),
        "prompts/get" => prompts_get_result(&req.params),
        _ => Err(anyhow!("method not found: {}", req.method)),
    };

    Some(match result {
        Ok(value) => success_response(id, value),
        Err(e) => {
            error!("request handling failed: {e}");
            error_response(id, -32601, e.to_string())
        }
    })
}

fn tools_list_result() -> Value {
    let tools = tool_specs()
        .into_iter()
        .map(|tool| {
            json!({
                "name": tool.name,
                "description": tool.description,
                "inputSchema": tool.input_schema
            })
        })
        .collect::<Vec<_>>();

    json!({ "tools": tools })
}

fn resources_list_result() -> Value {
    json!({
        "resources": [
            {
                "name": "compositions",
                "description": "List compositions in the current After Effects project",
                "uri": "aftereffects://compositions",
                "mimeType": "application/json"
            }
        ]
    })
}

fn prompts_list_result() -> Value {
    let prompts = prompt_specs()
        .into_iter()
        .map(|p| {
            json!({
                "name": p.name,
                "description": p.description,
                "arguments": p.arguments
            })
        })
        .collect::<Vec<_>>();

    json!({ "prompts": prompts })
}

fn prompts_get_result(params: &Value) -> Result<Value> {
    let name = params
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("prompts/get requires string parameter 'name'"))?;
    let args = params
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| Value::Object(Map::new()));

    prompt_messages(name, &args).ok_or_else(|| anyhow!("unknown prompt: {name}"))
}

fn resources_read_result(cfg: &AppConfig, bridge: &BridgeClient, params: &Value) -> Result<Value> {
    let uri = params
        .get("uri")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("resources/read requires parameter 'uri'"))?;

    if uri != "aftereffects://compositions" {
        return Err(anyhow!("unknown resource URI: {uri}"));
    }

    bridge.clear_results_file()?;
    bridge.write_command_file("listCompositions", json!({}))?;
    let text = bridge.wait_for_bridge_result(
        Some("listCompositions"),
        Duration::from_millis(cfg.result_timeout_ms + 1_000),
        Duration::from_millis(cfg.poll_interval_ms),
    )?;

    Ok(json!({
        "contents": [
            {
                "uri": uri,
                "mimeType": "application/json",
                "text": text
            }
        ]
    }))
}

fn tools_call_result(cfg: &AppConfig, bridge: &BridgeClient, params: &Value) -> Result<Value> {
    let name = params
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("tools/call requires 'name'"))?;
    let args = params
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| Value::Object(Map::new()));

    Ok(dispatch_tool(cfg, bridge, name, args))
}

fn dispatch_tool(cfg: &AppConfig, bridge: &BridgeClient, name: &str, args: Value) -> Value {
    let result = dispatch_tool_inner(cfg, bridge, name, args);
    match result {
        Ok(value) => value,
        Err(e) => tool_error(format!("Error: {e}")),
    }
}

fn dispatch_tool_inner(
    cfg: &AppConfig,
    bridge: &BridgeClient,
    name: &str,
    args: Value,
) -> Result<Value> {
    match name {
        "run-script" => {
            let script = args
                .get("script")
                .and_then(Value::as_str)
                .ok_or_else(|| anyhow!("'script' is required"))?;
            if !mcp_core::is_allowed_script(script) {
                return Ok(tool_error(format!(
                    "Script \"{script}\" is not allowed. Allowed scripts are: {}",
                    mcp_core::ALLOWED_SCRIPTS.join(", ")
                )));
            }
            let parameters = args.get("parameters").cloned().unwrap_or_else(|| json!({}));
            bridge.clear_results_file()?;
            bridge.write_command_file(script, parameters)?;
            Ok(tool_text(format!(
                "Command to run \"{script}\" has been queued.\nPlease ensure the \"MCP Bridge Auto\" panel is open in After Effects.\nUse the \"get-results\" tool after a few seconds to check for results."
            )))
        }
        "get-results" => {
            let text = bridge.read_results_with_stale_warning(Duration::from_secs(30))?;
            Ok(tool_text(text))
        }
        "get-help" => Ok(tool_text(general_help_text().to_string())),
        "create-composition" => {
            bridge.write_command_file("createComposition", args)?;
            Ok(tool_text(
                "Command to create composition has been queued.\nPlease ensure the \"MCP Bridge Auto\" panel is open in After Effects.\nUse the \"get-results\" tool after a few seconds to check for results.".to_string(),
            ))
        }
        "setLayerKeyframe" => {
            let comp_index = args.get("compIndex").and_then(Value::as_i64).unwrap_or(0);
            let layer_index = args.get("layerIndex").and_then(Value::as_i64).unwrap_or(0);
            let property_name = args
                .get("propertyName")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .to_string();
            bridge.write_command_file("setLayerKeyframe", args)?;
            Ok(tool_text(format!(
                "Command to set keyframe for \"{property_name}\" on layer {layer_index} in comp {comp_index} has been queued.\nUse the \"get-results\" tool after a few seconds to check for confirmation."
            )))
        }
        "setLayerExpression" => {
            let comp_index = args.get("compIndex").and_then(Value::as_i64).unwrap_or(0);
            let layer_index = args.get("layerIndex").and_then(Value::as_i64).unwrap_or(0);
            let property_name = args
                .get("propertyName")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .to_string();
            bridge.write_command_file("setLayerExpression", args)?;
            Ok(tool_text(format!(
                "Command to set expression for \"{property_name}\" on layer {layer_index} in comp {comp_index} has been queued.\nUse the \"get-results\" tool after a few seconds to check for confirmation."
            )))
        }
        "test-animation" => create_test_animation_script(args),
        "apply-effect" => {
            let comp_target = format_comp_target(&args);
            let layer_target = format_layer_target(&args);
            bridge.write_command_file("applyEffect", args)?;
            Ok(tool_text(format!(
                "Command to apply effect to {layer_target} in {comp_target} has been queued.\nUse the \"get-results\" tool after a few seconds to check for confirmation."
            )))
        }
        "apply-effect-template" => {
            let comp_target = format_comp_target(&args);
            let layer_target = format_layer_target(&args);
            let template_name = args
                .get("templateName")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .to_string();
            bridge.write_command_file("applyEffectTemplate", args)?;
            Ok(tool_text(format!(
                "Command to apply effect template '{template_name}' to {layer_target} in {comp_target} has been queued.\nUse the \"get-results\" tool after a few seconds to check for confirmation."
            )))
        }
        "list-supported-effects" => {
            bridge.write_command_file("listSupportedEffects", args)?;
            Ok(tool_text(
                "Command to list supported effects has been queued.\nUse the \"get-results\" tool after a few seconds to check for confirmation."
                    .to_string(),
            ))
        }
        "describe-effect" => {
            let has_effect_name = args
                .get("effectName")
                .and_then(Value::as_str)
                .map(|v| !v.trim().is_empty())
                .unwrap_or(false);
            let has_effect_match_name = args
                .get("effectMatchName")
                .and_then(Value::as_str)
                .map(|v| !v.trim().is_empty())
                .unwrap_or(false);
            if !has_effect_name && !has_effect_match_name {
                return Ok(tool_error(
                    "Either 'effectName' or 'effectMatchName' is required.".to_string(),
                ));
            }

            bridge.write_command_file("describeEffect", args)?;
            Ok(tool_text(
                "Command to describe effect has been queued.\nUse the \"get-results\" tool after a few seconds to check for confirmation."
                    .to_string(),
            ))
        }
        "mcp_aftereffects_applyEffect" => {
            run_direct_bridge_call(cfg, bridge, "applyEffect", args, "Error applying effect")
        }
        "mcp_aftereffects_applyEffectTemplate" => run_direct_bridge_call(
            cfg,
            bridge,
            "applyEffectTemplate",
            args,
            "Error applying effect template",
        ),
        "mcp_aftereffects_listSupportedEffects" => run_direct_bridge_call(
            cfg,
            bridge,
            "listSupportedEffects",
            args,
            "Error listing supported effects",
        ),
        "mcp_aftereffects_describeEffect" => {
            let has_effect_name = args
                .get("effectName")
                .and_then(Value::as_str)
                .map(|v| !v.trim().is_empty())
                .unwrap_or(false);
            let has_effect_match_name = args
                .get("effectMatchName")
                .and_then(Value::as_str)
                .map(|v| !v.trim().is_empty())
                .unwrap_or(false);
            if !has_effect_name && !has_effect_match_name {
                return Ok(tool_error(
                    "Either 'effectName' or 'effectMatchName' is required.".to_string(),
                ));
            }
            run_direct_bridge_call(
                cfg,
                bridge,
                "describeEffect",
                args,
                "Error describing effect",
            )
        }
        "mcp_aftereffects_get_effects_help" => Ok(tool_text(effects_help_text().to_string())),
        "run-bridge-test" => {
            bridge.clear_results_file()?;
            bridge.write_command_file("bridgeTestEffects", json!({}))?;
            Ok(tool_text(
                "Bridge test effects command has been queued.\nPlease ensure the \"MCP Bridge Auto\" panel is open in After Effects.\nUse the \"get-results\" tool after a few seconds to check for the test results."
                    .to_string(),
            ))
        }
        _ => Ok(tool_error(format!("Unknown tool: {name}"))),
    }
}

fn format_comp_target(args: &Value) -> String {
    if let Some(id) = args.get("compId").and_then(Value::as_i64) {
        format!("composition id {id}")
    } else if let Some(name) = args
        .get("compName")
        .and_then(Value::as_str)
        .filter(|name| !name.trim().is_empty())
    {
        format!("composition '{name}'")
    } else if let Some(index) = args.get("compIndex").and_then(Value::as_i64) {
        format!("composition {index}")
    } else {
        "resolved composition".to_string()
    }
}

fn format_layer_target(args: &Value) -> String {
    if let Some(id) = args.get("layerId").and_then(Value::as_i64) {
        format!("layer id {id}")
    } else if let Some(name) = args
        .get("layerName")
        .and_then(Value::as_str)
        .filter(|name| !name.trim().is_empty())
    {
        format!("layer '{name}'")
    } else if let Some(index) = args.get("layerIndex").and_then(Value::as_i64) {
        format!("layer {index}")
    } else {
        "resolved layer".to_string()
    }
}

fn run_direct_bridge_call(
    cfg: &AppConfig,
    bridge: &BridgeClient,
    command: &str,
    args: Value,
    error_prefix: &str,
) -> Result<Value> {
    bridge.clear_results_file()?;
    bridge.write_command_file(command, args)?;
    let result = bridge.wait_for_bridge_result(
        Some(command),
        Duration::from_millis(cfg.result_timeout_ms),
        Duration::from_millis(cfg.poll_interval_ms),
    );
    match result {
        Ok(text) => Ok(tool_text(text)),
        Err(e) => Ok(tool_error(format!("{error_prefix}: {e}"))),
    }
}

fn create_test_animation_script(args: Value) -> Result<Value> {
    let operation = args
        .get("operation")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("'operation' is required"))?;
    let comp_index = args.get("compIndex").and_then(Value::as_i64).unwrap_or(1);
    let layer_index = args.get("layerIndex").and_then(Value::as_i64).unwrap_or(1);

    if operation != "keyframe" && operation != "expression" {
        return Ok(tool_error(
            "operation must be one of: keyframe, expression".to_string(),
        ));
    }

    let file_name = format!(
        "ae_test_{}_{}.jsx",
        operation,
        chrono::Utc::now().timestamp_millis()
    );
    let script_path = std::env::temp_dir().join(file_name);
    let content = if operation == "keyframe" {
        format!(
            r#"
try {{
  var comp = app.project.items[{comp_index}];
  var layer = comp.layers[{layer_index}];
  var prop = layer.property("Transform").property("Opacity");
  prop.setValueAtTime(1, 25);
  alert("Test successful: Added opacity keyframe at 1s with value 25%");
}} catch (e) {{
  alert("Test failed: " + e.toString());
}}
"#
        )
    } else {
        format!(
            r#"
try {{
  var comp = app.project.items[{comp_index}];
  var layer = comp.layers[{layer_index}];
  var prop = layer.property("Transform").property("Position");
  prop.expression = "wiggle(3, 30)";
  alert("Test successful: Added position expression: wiggle(3, 30)");
}} catch (e) {{
  alert("Test failed: " + e.toString());
}}
"#
        )
    };

    fs::write(&script_path, content).with_context(|| {
        format!(
            "failed to write test script file: {}",
            script_path.display()
        )
    })?;

    Ok(tool_text(format!(
        "I've created a direct test script for the {operation} operation.\n\nPlease run this script manually in After Effects:\n1. In After Effects, go to File > Scripts > Run Script File...\n2. Navigate to: {}\n3. You should see an alert confirming the result.\n\nThis bypasses the MCP Bridge Auto panel and will directly modify the specified layer.",
        script_path.display()
    )))
}

fn tool_text(text: String) -> Value {
    json!({
        "content": [
            {
                "type": "text",
                "text": text
            }
        ]
    })
}

fn tool_error(text: String) -> Value {
    json!({
        "content": [
            {
                "type": "text",
                "text": text
            }
        ],
        "isError": true
    })
}

async fn read_jsonrpc_message<R>(reader: &mut R) -> Result<Option<Value>>
where
    R: AsyncBufRead + Unpin,
{
    let mut content_length: Option<usize> = None;
    loop {
        let mut line = String::new();
        let n = reader
            .read_line(&mut line)
            .await
            .with_context(|| "failed to read message header line")?;
        if n == 0 {
            if content_length.is_none() {
                return Ok(None);
            }
            return Err(anyhow!("unexpected EOF while reading MCP headers"));
        }

        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.is_empty() {
            break;
        }
        if let Some(rest) = trimmed.strip_prefix("Content-Length:") {
            let len = rest
                .trim()
                .parse::<usize>()
                .with_context(|| format!("invalid Content-Length header: {trimmed}"))?;
            content_length = Some(len);
        }
    }

    let len = content_length.ok_or_else(|| anyhow!("missing Content-Length header"))?;
    let mut buf = vec![0_u8; len];
    reader
        .read_exact(&mut buf)
        .await
        .with_context(|| "failed to read message body")?;
    let value = serde_json::from_slice::<Value>(&buf)
        .with_context(|| "failed to parse JSON-RPC request")?;
    Ok(Some(value))
}

async fn write_jsonrpc_message<W>(writer: &mut W, value: &Value) -> Result<()>
where
    W: AsyncWrite + Unpin,
{
    let payload = serde_json::to_vec(value).with_context(|| "failed to serialize response JSON")?;
    let header = format!("Content-Length: {}\r\n\r\n", payload.len());
    writer
        .write_all(header.as_bytes())
        .await
        .with_context(|| "failed to write response header")?;
    writer
        .write_all(&payload)
        .await
        .with_context(|| "failed to write response body")?;
    writer
        .flush()
        .await
        .with_context(|| "failed to flush response")
}

fn success_response(id: Value, result: Value) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": result
    })
}

fn error_response(id: Value, code: i64, message: String) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": {
            "code": code,
            "message": message
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tools_list_contains_run_script() {
        let result = tools_list_result();
        let tools = result
            .get("tools")
            .and_then(Value::as_array)
            .expect("tools array");
        assert!(tools
            .iter()
            .any(|t| t.get("name").and_then(Value::as_str) == Some("run-script")));
    }

    #[test]
    fn prompts_get_rejects_unknown_prompt() {
        let params = json!({ "name": "unknown", "arguments": {} });
        let err = prompts_get_result(&params).expect_err("must fail");
        assert!(err.to_string().contains("unknown prompt"));
    }

    #[test]
    fn tool_error_marks_is_error() {
        let v = tool_error("x".to_string());
        assert_eq!(v.get("isError").and_then(Value::as_bool), Some(true));
    }
}
