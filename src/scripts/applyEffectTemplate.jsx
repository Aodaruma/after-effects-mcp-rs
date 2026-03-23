// applyEffectTemplate.jsx
// Applies predefined effect templates to layers

function listOwnKeys(obj) {
    var keys = [];
    if (!obj) {
        return keys;
    }
    for (var k in obj) {
        if (obj.hasOwnProperty(k)) {
            keys.push(k);
        }
    }
    return keys;
}

function parseNumericId(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    var parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        return null;
    }
    return parsed;
}

function getCompId(comp) {
    try {
        if (comp && comp.id !== undefined && comp.id !== null) {
            var parsed = parseInt(comp.id, 10);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }
    } catch (_e) {}
    return null;
}

function getLayerId(layer) {
    try {
        if (layer && layer.id !== undefined && layer.id !== null) {
            var parsed = parseInt(layer.id, 10);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }
    } catch (_e) {}
    return null;
}

function resolveComposition(args) {
    var compId = parseNumericId(args.compId);
    var compName = args.compName || args.compositionName;
    var compIndex = args.compIndex;
    var i;

    if (compId !== null) {
        for (i = 1; i <= app.project.numItems; i++) {
            var byId = app.project.item(i);
            if (byId instanceof CompItem && getCompId(byId) === compId) {
                return byId;
            }
        }
        throw new Error("Composition not found by id " + compId);
    }

    if (compName) {
        for (i = 1; i <= app.project.numItems; i++) {
            var byName = app.project.item(i);
            if (byName instanceof CompItem && byName.name === compName) {
                return byName;
            }
        }
        throw new Error("Composition not found by name '" + compName + "'");
    }

    if (compIndex !== undefined && compIndex !== null) {
        var parsedCompIndex = parseInt(compIndex, 10);
        if (!isNaN(parsedCompIndex)) {
            var byIndex = app.project.item(parsedCompIndex);
            if (byIndex && byIndex instanceof CompItem) {
                return byIndex;
            }
            throw new Error("Composition not found at index " + parsedCompIndex);
        }
    }

    if (app.project.activeItem && app.project.activeItem instanceof CompItem) {
        return app.project.activeItem;
    }

    for (i = 1; i <= app.project.numItems; i++) {
        var firstComp = app.project.item(i);
        if (firstComp instanceof CompItem) {
            return firstComp;
        }
    }

    throw new Error("No composition found in project");
}

function resolveLayer(comp, args) {
    var layerId = parseNumericId(args.layerId);
    var layerName = args.layerName;
    var layerIndex = args.layerIndex;
    var j;

    if (layerId !== null) {
        for (j = 1; j <= comp.numLayers; j++) {
            var byId = comp.layer(j);
            if (getLayerId(byId) === layerId) {
                return byId;
            }
        }
        throw new Error("Layer not found by id " + layerId + " in composition '" + comp.name + "'");
    }

    if (layerName) {
        for (j = 1; j <= comp.numLayers; j++) {
            if (comp.layer(j).name === layerName) {
                return comp.layer(j);
            }
        }
        throw new Error("Layer not found by name '" + layerName + "' in composition '" + comp.name + "'");
    }

    if (layerIndex !== undefined && layerIndex !== null) {
        var parsedLayerIndex = parseInt(layerIndex, 10);
        if (!isNaN(parsedLayerIndex) && parsedLayerIndex > 0 && parsedLayerIndex <= comp.numLayers) {
            return comp.layer(parsedLayerIndex);
        }
        throw new Error("Layer index out of bounds: " + layerIndex + " in composition '" + comp.name + "'");
    }

    if (comp.selectedLayers && comp.selectedLayers.length > 0) {
        return comp.selectedLayers[0];
    }

    if (comp.numLayers > 0) {
        return comp.layer(1);
    }

    throw new Error("No layer found in composition '" + comp.name + "'");
}

function pushUnique(targetArray, value) {
    if (!value || typeof value !== "string") {
        return;
    }
    for (var i = 0; i < targetArray.length; i++) {
        if (targetArray[i] === value) {
            return;
        }
    }
    targetArray.push(value);
}

function addEffectWithFallback(layer, primaryMatchName, fallbackMatchNames) {
    var candidates = [];
    var failures = [];
    pushUnique(candidates, primaryMatchName);

    if (fallbackMatchNames && fallbackMatchNames.length) {
        for (var i = 0; i < fallbackMatchNames.length; i++) {
            pushUnique(candidates, fallbackMatchNames[i]);
        }
    }

    for (var x = 0; x < candidates.length; x++) {
        var candidate = candidates[x];
        try {
            var effect = layer.Effects.addProperty(candidate);
            if (effect) {
                return {
                    effect: effect,
                    identifier: candidate
                };
            }
        } catch (e) {
            failures.push(candidate + ": " + e.toString());
        }
    }

    throw new Error(
        "Failed to add template effect. Tried identifiers: " +
        candidates.join(", ") +
        (failures.length ? " | details: " + failures.join(" ; ") : "")
    );
}

function applyTemplateSettings(effect, settings) {
    if (!settings) {
        return;
    }

    var keys = listOwnKeys(settings);
    for (var i = 0; i < keys.length; i++) {
        var propName = keys[i];
        try {
            var property = effect.property(propName);
            if (property) {
                property.setValue(settings[propName]);
            }
        } catch (e) {
            $.writeln("Warning: Could not set " + propName + " on effect " + effect.name + ": " + e);
        }
    }
}

function applyEffectTemplate(args) {
    try {
        // Extract parameters
        var templateName = args.templateName; // Name of the template to apply
        var customSettings = args.customSettings || {}; // Optional customizations

        if (!templateName) {
            throw new Error("You must specify a templateName");
        }

        var comp = resolveComposition(args);
        var layer = resolveLayer(comp, args);

        // Template definitions
        var templates = {
            // Blur effects
            "gaussian-blur": {
                effects: [
                    {
                        effectMatchName: "ADBE Gaussian Blur 2",
                        settings: {
                            "Blurriness": customSettings.blurriness || 20
                        }
                    }
                ]
            },
            "directional-blur": {
                effects: [
                    {
                        effectMatchName: "ADBE Directional Blur",
                        settings: {
                            "Direction": customSettings.direction || 0,
                            "Blur Length": customSettings.length || 10
                        }
                    }
                ]
            },

            // Color correction effects
            "color-balance": {
                effects: [
                    {
                        effectMatchName: "ADBE Color Balance (HLS)",
                        settings: {
                            "Hue": customSettings.hue || 0,
                            "Lightness": customSettings.lightness || 0,
                            "Saturation": customSettings.saturation || 0
                        }
                    }
                ]
            },
            "brightness-contrast": {
                effects: [
                    {
                        effectMatchName: "ADBE Brightness & Contrast 2",
                        settings: {
                            "Brightness": customSettings.brightness || 0,
                            "Contrast": customSettings.contrast || 0,
                            "Use Legacy": false
                        }
                    }
                ]
            },
            "curves": {
                effects: [
                    {
                        effectMatchName: "ADBE CurvesCustom",
                        settings: {}
                    }
                ]
            },

            // Stylistic effects
            "glow": {
                effects: [
                    {
                        effectMatchName: "ADBE Glow",
                        settings: {
                            "Glow Threshold": customSettings.threshold || 50,
                            "Glow Radius": customSettings.radius || 15,
                            "Glow Intensity": customSettings.intensity || 1
                        }
                    }
                ]
            },
            "drop-shadow": {
                effects: [
                    {
                        effectMatchName: "ADBE Drop Shadow",
                        settings: {
                            "Shadow Color": customSettings.color || [0, 0, 0, 1],
                            "Opacity": customSettings.opacity || 50,
                            "Direction": customSettings.direction || 135,
                            "Distance": customSettings.distance || 10,
                            "Softness": customSettings.softness || 10
                        }
                    }
                ]
            },

            // Gradient compatibility template:
            // Prefer Gradient Ramp and fall back to 4 Color Gradient if unavailable.
            "smooth-gradient": {
                effects: [
                    {
                        effectMatchName: "ADBE Ramp",
                        fallbackMatchNames: ["Ramp", "ADBE 4ColorGradient", "ADBE 4 Color Gradient"],
                        settings: {
                            "Start Color": customSettings.startColor || [0.02, 0.08, 0.2],
                            "End Color": customSettings.endColor || [0.75, 0.85, 1.0],
                            "Start of Ramp": customSettings.startPoint || [0, 0],
                            "End of Ramp": customSettings.endPoint || [1920, 1080],
                            "Ramp Scatter": customSettings.scatter || 0,
                            "Blend With Original": customSettings.blend || 0
                        }
                    }
                ]
            },

            // Common effect chains
            "cinematic-look": {
                effects: [
                    {
                        effectMatchName: "ADBE CurvesCustom",
                        settings: {}
                    },
                    {
                        effectMatchName: "ADBE Vibrance",
                        settings: {
                            "Vibrance": 15,
                            "Saturation": -5
                        }
                    }
                ]
            },
            "text-pop": {
                effects: [
                    {
                        effectMatchName: "ADBE Drop Shadow",
                        settings: {
                            "Shadow Color": [0, 0, 0, 1],
                            "Opacity": 75,
                            "Distance": 5,
                            "Softness": 10
                        }
                    },
                    {
                        effectMatchName: "ADBE Glow",
                        settings: {
                            "Glow Threshold": 50,
                            "Glow Radius": 10,
                            "Glow Intensity": 1.5
                        }
                    }
                ]
            }
        };

        // Check if the requested template exists
        var template = templates[templateName];
        if (!template) {
            var availableTemplates = listOwnKeys(templates).join(", ");
            throw new Error("Template '" + templateName + "' not found. Available templates: " + availableTemplates);
        }

        var appliedEffects = [];
        var effects = template.effects || [];
        for (var i = 0; i < effects.length; i++) {
            var effectData = effects[i];
            var added = addEffectWithFallback(layer, effectData.effectMatchName, effectData.fallbackMatchNames || []);
            applyTemplateSettings(added.effect, effectData.settings || {});
            appliedEffects.push({
                name: added.effect.name,
                matchName: added.effect.matchName,
                usedIdentifier: added.identifier
            });
        }

        return JSON.stringify({
            status: "success",
            message: "Effect template '" + templateName + "' applied successfully",
            appliedEffects: appliedEffects,
            layer: {
                name: layer.name,
                index: layer.index,
                id: getLayerId(layer)
            },
            composition: {
                name: comp.name,
                id: comp.id
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    }
}

// Read arguments from the temp args file written by the launcher
var argsFile = new File($.fileName.replace(/[^\\\/]*$/, "") + "../temp/args.json");
var args = {};
if (argsFile.exists) {
    argsFile.open("r");
    var _content = argsFile.read();
    argsFile.close();
    if (_content) {
        try {
            args = JSON.parse(_content);
        } catch (_e) {
            args = {};
        }
    }
}

// Run the function and write the result
var result = applyEffectTemplate(args);

// Write the result so it can be captured by the Node.js process
$.write(result);
