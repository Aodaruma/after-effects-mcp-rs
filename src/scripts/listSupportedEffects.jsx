// listSupportedEffects.jsx
// Lists known effects and verifies availability on the current AE environment.

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

function knownEffectsCatalog() {
    return [
        { name: "Gaussian Blur", matchName: "ADBE Gaussian Blur 2", category: "Blur & Sharpen" },
        { name: "Directional Blur", matchName: "ADBE Directional Blur", category: "Blur & Sharpen" },
        { name: "Brightness & Contrast", matchName: "ADBE Brightness & Contrast 2", category: "Color Correction" },
        { name: "Color Balance (HLS)", matchName: "ADBE Color Balance (HLS)", category: "Color Correction" },
        { name: "Curves", matchName: "ADBE CurvesCustom", category: "Color Correction" },
        { name: "Vibrance", matchName: "ADBE Vibrance", category: "Color Correction" },
        { name: "Glow", matchName: "ADBE Glow", category: "Stylize" },
        { name: "Drop Shadow", matchName: "ADBE Drop Shadow", category: "Perspective" },
        { name: "Gradient Ramp", matchName: "ADBE Ramp", category: "Generate" },
        { name: "4 Color Gradient", matchName: "ADBE 4ColorGradient", category: "Generate" },
        { name: "Fractal Noise", matchName: "ADBE Fractal Noise", category: "Noise & Grain" },
        { name: "Noise", matchName: "ADBE Noise", category: "Noise & Grain" }
    ];
}

function probeEffect(layer, entry) {
    var candidates = [];
    var failures = [];
    pushUnique(candidates, entry.matchName);
    pushUnique(candidates, entry.name);

    if (entry.matchName === "ADBE Ramp") {
        pushUnique(candidates, "Ramp");
        pushUnique(candidates, "ADBE 4ColorGradient");
        pushUnique(candidates, "ADBE 4 Color Gradient");
    }

    for (var i = 0; i < candidates.length; i++) {
        var candidate = candidates[i];
        var addedEffect = null;
        try {
            addedEffect = layer.Effects.addProperty(candidate);
            if (addedEffect) {
                var resolvedName = addedEffect.name;
                var resolvedMatchName = addedEffect.matchName;
                try {
                    addedEffect.remove();
                } catch (_removeErr) {}
                return {
                    available: true,
                    usedIdentifier: candidate,
                    resolvedName: resolvedName,
                    resolvedMatchName: resolvedMatchName
                };
            }
        } catch (e) {
            failures.push(candidate + ": " + e.toString());
        }
    }

    return {
        available: false,
        error: failures.join(" ; ")
    };
}

function listSupportedEffects(args) {
    var probeContext = null;

    try {
        var options = args || {};
        var includeUnavailable = options.includeUnavailable === true;
        var comp = resolveComposition(options);
        probeContext = resolveProbeLayer(comp, options);
        var probeLayer = probeContext.layer;
        var catalog = knownEffectsCatalog();
        var effects = [];
        var availableCount = 0;
        var unavailableCount = 0;

        for (var i = 0; i < catalog.length; i++) {
            var entry = catalog[i];
            var probe = probeEffect(probeLayer, entry);
            if (probe.available) {
                availableCount++;
            } else {
                unavailableCount++;
            }
            if (probe.available || includeUnavailable) {
                effects.push({
                    name: entry.name,
                    matchName: entry.matchName,
                    category: entry.category,
                    available: probe.available,
                    usedIdentifier: probe.usedIdentifier || null,
                    resolvedName: probe.resolvedName || null,
                    resolvedMatchName: probe.resolvedMatchName || null,
                    error: probe.error || null
                });
            }
        }

        return JSON.stringify({
            status: "success",
            composition: {
                id: getCompId(comp),
                name: comp.name
            },
            probeLayer: {
                id: getLayerId(probeLayer),
                name: probeLayer.name,
                index: probeLayer.index,
                temporary: probeContext.cleanup
            },
            summary: {
                catalogSize: catalog.length,
                availableCount: availableCount,
                unavailableCount: unavailableCount
            },
            effects: effects
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    } finally {
        if (probeContext && probeContext.cleanup && probeContext.layer) {
            try {
                probeContext.layer.remove();
            } catch (_cleanupError) {}
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
var result = listSupportedEffects(args);

// Write the result so it can be captured by the Node.js process
$.write(result);
