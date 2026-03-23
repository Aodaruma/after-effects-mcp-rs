// applyEffect.jsx
// Applies an effect to a specified layer in a composition

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

function hasOwnEntries(obj) {
    if (!obj) {
        return false;
    }
    for (var k in obj) {
        if (obj.hasOwnProperty(k)) {
            return true;
        }
    }
    return false;
}

function resolveComposition(args) {
    var compName = args.compName || args.compositionName;
    var compIndex = args.compIndex;
    var i;

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
    var layerName = args.layerName;
    var layerIndex = args.layerIndex;
    var j;

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

function addEffectWithFallback(layer, effectName, effectMatchName) {
    var candidates = [];
    var failures = [];

    pushUnique(candidates, effectMatchName);
    pushUnique(candidates, effectName);

    var isRampRequest =
        effectMatchName === "ADBE Ramp" ||
        effectName === "ADBE Ramp" ||
        effectName === "Ramp" ||
        effectName === "Gradient Ramp";

    if (isRampRequest) {
        pushUnique(candidates, "ADBE Ramp");
        pushUnique(candidates, "Ramp");
        pushUnique(candidates, "ADBE 4ColorGradient");
        pushUnique(candidates, "ADBE 4 Color Gradient");
    }

    if (candidates.length === 0) {
        throw new Error("No valid effect identifier was provided");
    }

    for (var i = 0; i < candidates.length; i++) {
        var candidate = candidates[i];
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
        "Failed to add effect. Tried identifiers: " +
        candidates.join(", ") +
        (failures.length ? " | details: " + failures.join(" ; ") : "")
    );
}

function applyEffect(args) {
    try {
        // Extract parameters
        var effectName = args.effectName; // Name of the effect to apply
        var effectMatchName = args.effectMatchName; // After Effects internal name (more reliable)
        var presetPath = args.presetPath; // Optional path to an effect preset
        var effectSettings = args.effectSettings || {}; // Optional effect parameters

        if (!effectName && !effectMatchName && !presetPath) {
            throw new Error("You must specify either effectName, effectMatchName, or presetPath");
        }

        var comp = resolveComposition(args);
        var layer = resolveLayer(comp, args);
        var effectResult;

        // Apply preset if a path is provided
        if (presetPath) {
            var presetFile = new File(presetPath);
            if (!presetFile.exists) {
                throw new Error("Effect preset file not found: " + presetPath);
            }

            // Apply the preset to the layer
            layer.applyPreset(presetFile);
            effectResult = {
                type: "preset",
                name: presetPath.split("/").pop().split("\\").pop(),
                applied: true
            };
        } else {
            // Apply effect by match name/display name with fallback identifiers
            var added = addEffectWithFallback(layer, effectName, effectMatchName);
            effectResult = {
                type: "effect",
                name: added.effect.name,
                matchName: added.effect.matchName,
                index: added.effect.propertyIndex,
                usedIdentifier: added.identifier
            };

            // Apply settings if provided
            applyEffectSettings(added.effect, effectSettings);
        }

        return JSON.stringify({
            status: "success",
            message: "Effect applied successfully",
            effect: effectResult,
            layer: {
                name: layer.name,
                index: layer.index
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

// Helper function to apply effect settings
function applyEffectSettings(effect, settings) {
    // Skip if no settings are provided
    if (!hasOwnEntries(settings)) {
        return;
    }

    var settingKeys = listOwnKeys(settings);

    // Iterate through all provided settings
    for (var x = 0; x < settingKeys.length; x++) {
        var propName = settingKeys[x];
        try {
            // Find the property in the effect
            var property = null;

            // Try direct property access first
            try {
                property = effect.property(propName);
            } catch (e) {
                // If direct access fails, search through all properties
                for (var i = 1; i <= effect.numProperties; i++) {
                    var prop = effect.property(i);
                    if (prop.name === propName) {
                        property = prop;
                        break;
                    }
                }
            }

            // Set the property value if found
            if (property && property.setValue) {
                property.setValue(settings[propName]);
            }
        } catch (e2) {
            // Log error but continue with other properties
            $.writeln("Error setting effect property '" + propName + "': " + e2.toString());
        }
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
var result = applyEffect(args);

// Write the result so it can be captured by the Node.js process
$.write(result);
