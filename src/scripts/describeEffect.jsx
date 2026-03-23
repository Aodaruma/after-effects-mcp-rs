// describeEffect.jsx
// Adds an effect temporarily and returns its available parameter metadata.

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

function hasExplicitLayerTarget(args) {
    return args.layerId !== undefined ||
        args.layerName !== undefined ||
        args.layerIndex !== undefined;
}

function resolveProbeLayer(comp, args) {
    if (hasExplicitLayerTarget(args)) {
        return {
            layer: resolveLayer(comp, args),
            cleanup: false
        };
    }

    if (comp.selectedLayers && comp.selectedLayers.length > 0) {
        return {
            layer: comp.selectedLayers[0],
            cleanup: false
        };
    }

    if (comp.numLayers > 0) {
        return {
            layer: comp.layer(1),
            cleanup: false
        };
    }

    var probeLayer = comp.layers.addSolid(
        [0.5, 0.5, 0.5],
        "__mcp_probe_layer__",
        Math.max(1, comp.width),
        Math.max(1, comp.height),
        1,
        Math.max(1, comp.duration)
    );
    probeLayer.enabled = false;
    return {
        layer: probeLayer,
        cleanup: true
    };
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

function serializeValue(value) {
    if (value === null || value === undefined) {
        return value;
    }
    var t = typeof value;
    if (t === "number" || t === "string" || t === "boolean") {
        return value;
    }
    if (value instanceof Array) {
        var arr = [];
        for (var i = 0; i < value.length; i++) {
            arr.push(serializeValue(value[i]));
        }
        return arr;
    }
    try {
        return value.toString();
    } catch (_e) {}
    return null;
}

function describeEffectProperties(effect) {
    var properties = [];

    for (var i = 1; i <= effect.numProperties; i++) {
        var prop = effect.property(i);
        if (!prop) {
            continue;
        }

        var row = {
            index: i,
            name: prop.name || "",
            matchName: prop.matchName || "",
            propertyValueType: prop.propertyValueType,
            canSetExpression: !!prop.canSetExpression
        };

        try {
            if (prop.hasMin) {
                row.minValue = prop.minValue;
            }
        } catch (_minErr) {}

        try {
            if (prop.hasMax) {
                row.maxValue = prop.maxValue;
            }
        } catch (_maxErr) {}

        try {
            row.currentValue = serializeValue(prop.value);
        } catch (_valueErr) {}

        properties.push(row);
    }

    return properties;
}

function describeEffect(args) {
    var probeContext = null;
    var added = null;

    try {
        var options = args || {};
        var effectName = options.effectName;
        var effectMatchName = options.effectMatchName;
        if (!effectName && !effectMatchName) {
            throw new Error("You must specify either effectName or effectMatchName");
        }

        var comp = resolveComposition(options);
        probeContext = resolveProbeLayer(comp, options);
        var layer = probeContext.layer;

        added = addEffectWithFallback(layer, effectName, effectMatchName);
        var effect = added.effect;
        var properties = describeEffectProperties(effect);

        return JSON.stringify({
            status: "success",
            composition: {
                id: getCompId(comp),
                name: comp.name
            },
            layer: {
                id: getLayerId(layer),
                name: layer.name,
                index: layer.index,
                temporary: probeContext.cleanup
            },
            effect: {
                name: effect.name,
                matchName: effect.matchName,
                usedIdentifier: added.identifier,
                propertyCount: properties.length,
                properties: properties
            }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    } finally {
        if (added && added.effect) {
            try {
                added.effect.remove();
            } catch (_removeEffectErr) {}
        }
        if (probeContext && probeContext.cleanup && probeContext.layer) {
            try {
                probeContext.layer.remove();
            } catch (_cleanupErr) {}
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
var result = describeEffect(args);

// Write the result so it can be captured by the Node.js process
$.write(result);
