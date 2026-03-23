use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

pub const ALLOWED_SCRIPTS: &[&str] = &[
    "listCompositions",
    "getProjectInfo",
    "getLayerInfo",
    "createComposition",
    "createTextLayer",
    "createShapeLayer",
    "createSolidLayer",
    "setLayerProperties",
    "setLayerKeyframe",
    "setLayerExpression",
    "applyEffect",
    "applyEffectTemplate",
    "listSupportedEffects",
    "describeEffect",
    "test-animation",
    "bridgeTestEffects",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BridgePaths {
    pub root_dir: PathBuf,
    pub command_file: PathBuf,
    pub result_file: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppConfig {
    pub bridge: BridgePaths,
    pub poll_interval_ms: u64,
    pub result_timeout_ms: u64,
    pub log_level: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let root_dir = default_bridge_root_dir();
        let command_file = root_dir.join("ae_command.json");
        let result_file = root_dir.join("ae_mcp_result.json");

        Self {
            bridge: BridgePaths {
                root_dir,
                command_file,
                result_file,
            },
            poll_interval_ms: 250,
            result_timeout_ms: 5_000,
            log_level: "info".to_string(),
        }
    }
}

impl AppConfig {
    pub fn load(config_path: Option<&Path>) -> Result<Self> {
        if let Some(path) = config_path {
            let raw = fs::read_to_string(path)
                .with_context(|| format!("failed to read config file: {}", path.display()))?;
            let cfg: AppConfig =
                toml::from_str(&raw).with_context(|| "failed to parse TOML config")?;
            Ok(cfg)
        } else {
            Ok(Self::default())
        }
    }
}

pub fn default_bridge_root_dir() -> PathBuf {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join("Documents").join("ae-mcp-bridge")
}

pub fn is_allowed_script(script: &str) -> bool {
    ALLOWED_SCRIPTS.contains(&script)
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ToolSpec {
    pub name: &'static str,
    pub description: &'static str,
    pub input_schema: Value,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct PromptSpec {
    pub name: &'static str,
    pub description: &'static str,
    pub arguments: Vec<PromptArgument>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct PromptArgument {
    pub name: &'static str,
    pub description: &'static str,
    pub required: bool,
}

pub fn tool_specs() -> Vec<ToolSpec> {
    vec![
        ToolSpec {
            name: "run-script",
            description: "Run a predefined script in After Effects (read/write depending on script)",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "script": { "type": "string" },
                    "parameters": { "type": "object" }
                },
                "required": ["script"]
            }),
        },
        ToolSpec {
            name: "get-results",
            description: "Get results from the last script executed in After Effects",
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
        },
        ToolSpec {
            name: "get-help",
            description: "Get help on using the After Effects MCP integration",
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
        },
        ToolSpec {
            name: "create-composition",
            description: "Create a new composition in After Effects with specified parameters",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "width": { "type": "integer", "minimum": 1 },
                    "height": { "type": "integer", "minimum": 1 },
                    "pixelAspect": { "type": "number", "minimum": 0.0001 },
                    "duration": { "type": "number", "minimum": 0.0001 },
                    "frameRate": { "type": "number", "minimum": 0.0001 },
                    "backgroundColor": {
                        "type": "object",
                        "properties": {
                            "r": { "type": "integer", "minimum": 0, "maximum": 255 },
                            "g": { "type": "integer", "minimum": 0, "maximum": 255 },
                            "b": { "type": "integer", "minimum": 0, "maximum": 255 }
                        }
                    }
                },
                "required": ["name", "width", "height"]
            }),
        },
        ToolSpec {
            name: "setLayerKeyframe",
            description: "Set a keyframe for a specific layer property at a given time.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "compIndex": { "type": "integer", "minimum": 1 },
                    "layerIndex": { "type": "integer", "minimum": 1 },
                    "propertyName": { "type": "string" },
                    "timeInSeconds": { "type": "number" },
                    "value": {}
                },
                "required": ["compIndex", "layerIndex", "propertyName", "timeInSeconds", "value"]
            }),
        },
        ToolSpec {
            name: "setLayerExpression",
            description: "Set or remove an expression for a specific layer property.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "compIndex": { "type": "integer", "minimum": 1 },
                    "layerIndex": { "type": "integer", "minimum": 1 },
                    "propertyName": { "type": "string" },
                    "expressionString": { "type": "string" }
                },
                "required": ["compIndex", "layerIndex", "propertyName", "expressionString"]
            }),
        },
        ToolSpec {
            name: "test-animation",
            description: "Test animation functionality in After Effects",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "operation": { "type": "string", "enum": ["keyframe", "expression"] },
                    "compIndex": { "type": "integer", "minimum": 1 },
                    "layerIndex": { "type": "integer", "minimum": 1 }
                },
                "required": ["operation", "compIndex", "layerIndex"]
            }),
        },
        ToolSpec {
            name: "apply-effect",
            description: "Apply an effect to a layer in After Effects",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "compId": { "type": "integer", "minimum": 1 },
                    "compIndex": { "type": "integer", "minimum": 1 },
                    "compName": { "type": "string" },
                    "layerId": { "type": "integer", "minimum": 1 },
                    "layerIndex": { "type": "integer", "minimum": 1 },
                    "layerName": { "type": "string" },
                    "effectName": { "type": "string" },
                    "effectMatchName": { "type": "string" },
                    "effectCategory": { "type": "string" },
                    "presetPath": { "type": "string" },
                    "effectSettings": { "type": "object" }
                }
            }),
        },
        ToolSpec {
            name: "apply-effect-template",
            description: "Apply a predefined effect template to a layer in After Effects",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "compId": { "type": "integer", "minimum": 1 },
                    "compIndex": { "type": "integer", "minimum": 1 },
                    "compName": { "type": "string" },
                    "layerId": { "type": "integer", "minimum": 1 },
                    "layerIndex": { "type": "integer", "minimum": 1 },
                    "layerName": { "type": "string" },
                    "templateName": {
                        "type": "string",
                        "enum": [
                            "gaussian-blur",
                            "directional-blur",
                            "color-balance",
                            "brightness-contrast",
                            "curves",
                            "glow",
                            "drop-shadow",
                            "smooth-gradient",
                            "cinematic-look",
                            "text-pop"
                        ]
                    },
                    "customSettings": { "type": "object" }
                },
                "required": ["templateName"]
            }),
        },
        ToolSpec {
            name: "list-supported-effects",
            description: "List known effects and verify availability in the current After Effects environment",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "compId": { "type": "integer", "minimum": 1 },
                    "compIndex": { "type": "integer", "minimum": 1 },
                    "compName": { "type": "string" },
                    "layerId": { "type": "integer", "minimum": 1 },
                    "layerIndex": { "type": "integer", "minimum": 1 },
                    "layerName": { "type": "string" },
                    "includeUnavailable": { "type": "boolean" }
                }
            }),
        },
        ToolSpec {
            name: "describe-effect",
            description: "Describe available parameters for a specific effect by temporarily probing it on a layer",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "compId": { "type": "integer", "minimum": 1 },
                    "compIndex": { "type": "integer", "minimum": 1 },
                    "compName": { "type": "string" },
                    "layerId": { "type": "integer", "minimum": 1 },
                    "layerIndex": { "type": "integer", "minimum": 1 },
                    "layerName": { "type": "string" },
                    "effectName": { "type": "string" },
                    "effectMatchName": { "type": "string" }
                }
            }),
        },
        ToolSpec {
            name: "mcp_aftereffects_applyEffect",
            description: "Apply an effect to a layer in After Effects",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "compId": { "type": "integer", "minimum": 1 },
                    "compIndex": { "type": "integer", "minimum": 1 },
                    "compName": { "type": "string" },
                    "layerId": { "type": "integer", "minimum": 1 },
                    "layerIndex": { "type": "integer", "minimum": 1 },
                    "layerName": { "type": "string" },
                    "effectName": { "type": "string" },
                    "effectMatchName": { "type": "string" },
                    "effectSettings": { "type": "object" }
                }
            }),
        },
        ToolSpec {
            name: "mcp_aftereffects_applyEffectTemplate",
            description: "Apply a predefined effect template to a layer in After Effects",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "compId": { "type": "integer", "minimum": 1 },
                    "compIndex": { "type": "integer", "minimum": 1 },
                    "compName": { "type": "string" },
                    "layerId": { "type": "integer", "minimum": 1 },
                    "layerIndex": { "type": "integer", "minimum": 1 },
                    "layerName": { "type": "string" },
                    "templateName": {
                        "type": "string",
                        "enum": [
                            "gaussian-blur",
                            "directional-blur",
                            "color-balance",
                            "brightness-contrast",
                            "curves",
                            "glow",
                            "drop-shadow",
                            "smooth-gradient",
                            "cinematic-look",
                            "text-pop"
                        ]
                    },
                    "customSettings": { "type": "object" }
                },
                "required": ["templateName"]
            }),
        },
        ToolSpec {
            name: "mcp_aftereffects_listSupportedEffects",
            description: "List known effects and verify availability in the current After Effects environment",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "compId": { "type": "integer", "minimum": 1 },
                    "compIndex": { "type": "integer", "minimum": 1 },
                    "compName": { "type": "string" },
                    "layerId": { "type": "integer", "minimum": 1 },
                    "layerIndex": { "type": "integer", "minimum": 1 },
                    "layerName": { "type": "string" },
                    "includeUnavailable": { "type": "boolean" }
                }
            }),
        },
        ToolSpec {
            name: "mcp_aftereffects_describeEffect",
            description: "Describe available parameters for a specific effect by temporarily probing it on a layer",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "compId": { "type": "integer", "minimum": 1 },
                    "compIndex": { "type": "integer", "minimum": 1 },
                    "compName": { "type": "string" },
                    "layerId": { "type": "integer", "minimum": 1 },
                    "layerIndex": { "type": "integer", "minimum": 1 },
                    "layerName": { "type": "string" },
                    "effectName": { "type": "string" },
                    "effectMatchName": { "type": "string" }
                }
            }),
        },
        ToolSpec {
            name: "mcp_aftereffects_get_effects_help",
            description: "Get help on using After Effects effects",
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
        },
        ToolSpec {
            name: "run-bridge-test",
            description: "Run the bridge test effects script to verify communication",
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
        },
    ]
}

pub fn prompt_specs() -> Vec<PromptSpec> {
    vec![
        PromptSpec {
            name: "list-compositions",
            description: "List compositions in the current After Effects project",
            arguments: vec![],
        },
        PromptSpec {
            name: "analyze-composition",
            description: "Analyze a composition by name",
            arguments: vec![PromptArgument {
                name: "compositionName",
                description: "Name of the composition to analyze",
                required: true,
            }],
        },
        PromptSpec {
            name: "create-composition",
            description: "Create a new composition with custom settings",
            arguments: vec![],
        },
    ]
}

pub fn prompt_messages(name: &str, args: &Value) -> Option<Value> {
    let msg = match name {
        "list-compositions" => {
            "Please list all compositions in the current After Effects project.".to_string()
        }
        "analyze-composition" => {
            let target = args
                .get("compositionName")
                .and_then(Value::as_str)
                .unwrap_or("Unknown");
            format!(
                "Please analyze the composition named \"{target}\" in the current After Effects project. Provide details about its duration, frame rate, resolution, and layers."
            )
        }
        "create-composition" => {
            "Please create a new composition with custom settings. You can specify parameters like name, width, height, frame rate, etc.".to_string()
        }
        _ => return None,
    };

    Some(json!({
        "messages": [
            {
                "role": "user",
                "content": {
                    "type": "text",
                    "text": msg
                }
            }
        ]
    }))
}

pub fn general_help_text() -> &'static str {
    r#"# After Effects MCP Integration Help

To use this integration with After Effects, follow these steps:

1. Install bridge panel script with the installer command
2. Open Adobe After Effects
3. Open Window > mcp-bridge-auto.jsx
4. Enable "Auto-run commands"
5. Use tools from MCP client and read back results

Available scripts:
- getProjectInfo
- listCompositions
- getLayerInfo
- createComposition
- createTextLayer
- createShapeLayer
- createSolidLayer
- setLayerProperties
- setLayerKeyframe
- setLayerExpression
- applyEffect
- applyEffectTemplate
- listSupportedEffects
- describeEffect
"#
}

pub fn effects_help_text() -> &'static str {
    r#"# After Effects Effects Help

Common Effect Match Names:
- Gaussian Blur: ADBE Gaussian Blur 2
- Directional Blur: ADBE Directional Blur
- Brightness & Contrast: ADBE Brightness & Contrast 2
- Color Balance (HLS): ADBE Color Balance (HLS)
- Curves: ADBE CurvesCustom
- Glow: ADBE Glow
- Drop Shadow: ADBE Drop Shadow
- Vibrance: ADBE Vibrance

Templates:
- gaussian-blur
- directional-blur
- color-balance
- brightness-contrast
- curves
- glow
- drop-shadow
- smooth-gradient
- cinematic-look
- text-pop

Additional tools:
- list-supported-effects
- describe-effect
"#
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_has_expected_files() {
        let cfg = AppConfig::default();
        assert!(cfg.bridge.command_file.ends_with("ae_command.json"));
        assert!(cfg.bridge.result_file.ends_with("ae_mcp_result.json"));
        assert_eq!(cfg.poll_interval_ms, 250);
    }

    #[test]
    fn script_allowlist_contains_core_entries() {
        assert!(is_allowed_script("listCompositions"));
        assert!(is_allowed_script("applyEffectTemplate"));
        assert!(!is_allowed_script("unknownScript"));
    }
}
