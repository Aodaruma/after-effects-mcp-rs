// mcp-bridge-auto.jsx
// Auto-running MCP Bridge panel for After Effects

// Remove #include directives as we define functions below
/*
#include "createComposition.jsx"
#include "createTextLayer.jsx"
#include "createShapeLayer.jsx"
#include "createSolidLayer.jsx"
#include "setLayerProperties.jsx"
*/

// --- Function Definitions ---

// --- createComposition (from createComposition.jsx) --- 
function createComposition(args) {
    try {
        var name = args.name || "New Composition";
        var width = parseInt(args.width) || 1920;
        var height = parseInt(args.height) || 1080;
        var pixelAspect = parseFloat(args.pixelAspect) || 1.0;
        var duration = parseFloat(args.duration) || 10.0;
        var frameRate = parseFloat(args.frameRate) || 30.0;
        var bgColor = args.backgroundColor ? [args.backgroundColor.r/255, args.backgroundColor.g/255, args.backgroundColor.b/255] : [0, 0, 0];
        var newComp = app.project.items.addComp(name, width, height, pixelAspect, duration, frameRate);
        if (args.backgroundColor) {
            newComp.bgColor = bgColor;
        }
        return JSON.stringify({
            status: "success", message: "Composition created successfully",
            composition: { name: newComp.name, id: newComp.id, width: newComp.width, height: newComp.height, pixelAspect: newComp.pixelAspect, duration: newComp.duration, frameRate: newComp.frameRate, bgColor: newComp.bgColor }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- createTextLayer (from createTextLayer.jsx) ---
function createTextLayer(args) {
    try {
        var compName = args.compName || "";
        var text = args.text || "Text Layer";
        var position = args.position || [960, 540]; 
        var fontSize = args.fontSize || 72;
        var color = args.color || [1, 1, 1]; 
        var startTime = args.startTime || 0;
        var duration = args.duration || 5; 
        var fontFamily = args.fontFamily || "Arial";
        var alignment = args.alignment || "center"; 
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; } 
            else { throw new Error("No composition found with name '" + compName + "' and no active composition"); }
        }
        var textLayer = comp.layers.addText(text);
        var textProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document");
        var textDocument = textProp.value;
        textDocument.fontSize = fontSize;
        textDocument.fillColor = color;
        textDocument.font = fontFamily;
        if (alignment === "left") { textDocument.justification = ParagraphJustification.LEFT_JUSTIFY; } 
        else if (alignment === "center") { textDocument.justification = ParagraphJustification.CENTER_JUSTIFY; } 
        else if (alignment === "right") { textDocument.justification = ParagraphJustification.RIGHT_JUSTIFY; }
        textProp.setValue(textDocument);
        textLayer.property("Position").setValue(position);
        textLayer.startTime = startTime;
        if (duration > 0) { textLayer.outPoint = startTime + duration; }
        return JSON.stringify({
            status: "success", message: "Text layer created successfully",
            layer: { name: textLayer.name, index: textLayer.index, id: fxGetLayerId(textLayer), type: "text", inPoint: textLayer.inPoint, outPoint: textLayer.outPoint, position: textLayer.property("Position").value }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- createShapeLayer (from createShapeLayer.jsx) --- 
function createShapeLayer(args) {
    try {
        var compName = args.compName || "";
        var shapeType = args.shapeType || "rectangle"; 
        var position = args.position || [960, 540]; 
        var size = args.size || [200, 200]; 
        var fillColor = args.fillColor || [1, 0, 0]; 
        var strokeColor = args.strokeColor || [0, 0, 0]; 
        var strokeWidth = args.strokeWidth || 0; 
        var startTime = args.startTime || 0;
        var duration = args.duration || 5; 
        var name = args.name || "Shape Layer";
        var points = args.points || 5; 
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; } 
            else { throw new Error("No composition found with name '" + compName + "' and no active composition"); }
        }
        var shapeLayer = comp.layers.addShape();
        shapeLayer.name = name;
        var contents = shapeLayer.property("Contents"); 
        var shapeGroup = contents.addProperty("ADBE Vector Group");
        var groupContents = shapeGroup.property("Contents"); 
        var shapePathProperty;
        if (shapeType === "rectangle") {
            shapePathProperty = groupContents.addProperty("ADBE Vector Shape - Rect");
            shapePathProperty.property("Size").setValue(size);
        } else if (shapeType === "ellipse") {
            shapePathProperty = groupContents.addProperty("ADBE Vector Shape - Ellipse");
            shapePathProperty.property("Size").setValue(size);
        } else if (shapeType === "polygon" || shapeType === "star") { 
            shapePathProperty = groupContents.addProperty("ADBE Vector Shape - Star");
            shapePathProperty.property("Type").setValue(shapeType === "polygon" ? 1 : 2); 
            shapePathProperty.property("Points").setValue(points);
            shapePathProperty.property("Outer Radius").setValue(size[0] / 2);
            if (shapeType === "star") { shapePathProperty.property("Inner Radius").setValue(size[0] / 3); }
        }
        var fill = groupContents.addProperty("ADBE Vector Graphic - Fill");
        fill.property("Color").setValue(fillColor);
        fill.property("Opacity").setValue(100);
        if (strokeWidth > 0) {
            var stroke = groupContents.addProperty("ADBE Vector Graphic - Stroke");
            stroke.property("Color").setValue(strokeColor);
            stroke.property("Stroke Width").setValue(strokeWidth);
            stroke.property("Opacity").setValue(100);
        }
        shapeLayer.property("Position").setValue(position);
        shapeLayer.startTime = startTime;
        if (duration > 0) { shapeLayer.outPoint = startTime + duration; }
        return JSON.stringify({
            status: "success", message: "Shape layer created successfully",
            layer: { name: shapeLayer.name, index: shapeLayer.index, id: fxGetLayerId(shapeLayer), type: "shape", shapeType: shapeType, inPoint: shapeLayer.inPoint, outPoint: shapeLayer.outPoint, position: shapeLayer.property("Position").value }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- createSolidLayer (from createSolidLayer.jsx) --- 
function createSolidLayer(args) {
    try {
        var compName = args.compName || "";
        var color = args.color || [1, 1, 1]; 
        var name = args.name || "Solid Layer";
        var position = args.position || [960, 540]; 
        var size = args.size; 
        var startTime = args.startTime || 0;
        var duration = args.duration || 5; 
        var isAdjustment = args.isAdjustment || false; 
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; } 
            else { throw new Error("No composition found with name '" + compName + "' and no active composition"); }
        }
        if (!size) { size = [comp.width, comp.height]; }
        var solidLayer;
        if (isAdjustment) {
            solidLayer = comp.layers.addSolid([0, 0, 0], name, size[0], size[1], 1);
            solidLayer.adjustmentLayer = true;
        } else {
            solidLayer = comp.layers.addSolid(color, name, size[0], size[1], 1);
        }
        solidLayer.property("Position").setValue(position);
        solidLayer.startTime = startTime;
        if (duration > 0) { solidLayer.outPoint = startTime + duration; }
        return JSON.stringify({
            status: "success", message: isAdjustment ? "Adjustment layer created successfully" : "Solid layer created successfully",
            layer: { name: solidLayer.name, index: solidLayer.index, id: fxGetLayerId(solidLayer), type: isAdjustment ? "adjustment" : "solid", inPoint: solidLayer.inPoint, outPoint: solidLayer.outPoint, position: solidLayer.property("Position").value, isAdjustment: solidLayer.adjustmentLayer }
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

// --- setLayerProperties (modified to handle text properties) ---
function setLayerProperties(args) {
    try {
        var compName = args.compName || "";
        var layerName = args.layerName || "";
        var layerIndex = args.layerIndex; 
        
        // General Properties
        var position = args.position; 
        var scale = args.scale; 
        var rotation = args.rotation; 
        var opacity = args.opacity; 
        var startTime = args.startTime; 
        var duration = args.duration; 

        // Text Specific Properties
        var textContent = args.text; // New: text content
        var fontFamily = args.fontFamily; // New: font family
        var fontSize = args.fontSize; // New: font size
        var fillColor = args.fillColor; // New: font color
        
        // Find the composition (same logic as before)
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) { comp = item; break; }
        }
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) { comp = app.project.activeItem; } 
            else { throw new Error("No composition found with name '" + compName + "' and no active composition"); }
        }
        
        // Find the layer (same logic as before)
        var layer = null;
        if (layerIndex !== undefined && layerIndex !== null) {
            if (layerIndex > 0 && layerIndex <= comp.numLayers) { layer = comp.layer(layerIndex); } 
            else { throw new Error("Layer index out of bounds: " + layerIndex); }
        } else if (layerName) {
            for (var j = 1; j <= comp.numLayers; j++) {
                if (comp.layer(j).name === layerName) { layer = comp.layer(j); break; }
            }
        }
        if (!layer) { throw new Error("Layer not found: " + (layerName || "index " + layerIndex)); }
        
        var changedProperties = [];
        var textDocumentChanged = false;
        var textProp = null;
        var textDocument = null;

        // --- Text Property Handling ---
        if (layer instanceof TextLayer && (textContent !== undefined || fontFamily !== undefined || fontSize !== undefined || fillColor !== undefined)) {
            var sourceTextProp = layer.property("Source Text");
            if (sourceTextProp && sourceTextProp.value) {
                var currentTextDocument = sourceTextProp.value; // Get the current value
                var updated = false;

                if (textContent !== undefined && textContent !== null && currentTextDocument.text !== textContent) {
                    currentTextDocument.text = textContent;
                    changedProperties.push("text");
                    updated = true;
                }
                if (fontFamily !== undefined && fontFamily !== null && currentTextDocument.font !== fontFamily) {
                    // Add basic validation/logging for font existence if needed
                    // try { app.fonts.findFont(fontFamily); } catch (e) { logToPanel("Warning: Font '"+fontFamily+"' might not be installed."); }
                    currentTextDocument.font = fontFamily;
                    changedProperties.push("fontFamily");
                    updated = true;
                }
                if (fontSize !== undefined && fontSize !== null && currentTextDocument.fontSize !== fontSize) {
                    currentTextDocument.fontSize = fontSize;
                    changedProperties.push("fontSize");
                    updated = true;
                }
                // Comparing colors needs care due to potential floating point inaccuracies if set via UI
                // Simple comparison for now
                if (fillColor !== undefined && fillColor !== null && 
                    (currentTextDocument.fillColor[0] !== fillColor[0] || 
                     currentTextDocument.fillColor[1] !== fillColor[1] || 
                     currentTextDocument.fillColor[2] !== fillColor[2])) {
                    currentTextDocument.fillColor = fillColor;
                    changedProperties.push("fillColor");
                    updated = true;
                }

                // Only set the value if something actually changed
                if (updated) {
                    try {
                        sourceTextProp.setValue(currentTextDocument);
                        logToPanel("Applied changes to Text Document for layer: " + layer.name);
                    } catch (e) {
                        logToPanel("ERROR applying Text Document changes: " + e.toString());
                        // Decide if we should throw or just log the error for text properties
                        // For now, just log, other properties might still succeed
                    }
                }
                 // Store the potentially updated document for the return value
                 textDocument = currentTextDocument; 

            } else {
                logToPanel("Warning: Could not access Source Text property for layer: " + layer.name);
            }
        }

        // --- General Property Handling ---
        if (position !== undefined && position !== null) { layer.property("Position").setValue(position); changedProperties.push("position"); }
        if (scale !== undefined && scale !== null) { layer.property("Scale").setValue(scale); changedProperties.push("scale"); }
        if (rotation !== undefined && rotation !== null) {
            if (layer.threeDLayer) { 
                // For 3D layers, Z rotation is often what's intended by a single value
                layer.property("Z Rotation").setValue(rotation);
            } else { 
                layer.property("Rotation").setValue(rotation); 
            }
            changedProperties.push("rotation");
        }
        if (opacity !== undefined && opacity !== null) { layer.property("Opacity").setValue(opacity); changedProperties.push("opacity"); }
        if (startTime !== undefined && startTime !== null) { layer.startTime = startTime; changedProperties.push("startTime"); }
        if (duration !== undefined && duration !== null && duration > 0) {
            var actualStartTime = (startTime !== undefined && startTime !== null) ? startTime : layer.startTime;
            layer.outPoint = actualStartTime + duration;
            changedProperties.push("duration");
        }

        // Return success with updated layer details (including text if changed)
        var returnLayerInfo = {
            name: layer.name,
            index: layer.index,
            position: layer.property("Position").value,
            scale: layer.property("Scale").value,
            rotation: layer.threeDLayer ? layer.property("Z Rotation").value : layer.property("Rotation").value, // Return appropriate rotation
            opacity: layer.property("Opacity").value,
            inPoint: layer.inPoint,
            outPoint: layer.outPoint,
            changedProperties: changedProperties
        };
        // Add text properties to the return object if it was a text layer
        if (layer instanceof TextLayer && textDocument) {
            returnLayerInfo.text = textDocument.text;
            returnLayerInfo.fontFamily = textDocument.font;
            returnLayerInfo.fontSize = textDocument.fontSize;
            returnLayerInfo.fillColor = textDocument.fillColor;
        }

        // *** ADDED LOGGING HERE ***
        logToPanel("Final check before return:");
        logToPanel("  Changed Properties: " + changedProperties.join(", "));
        logToPanel("  Return Layer Info Font: " + (returnLayerInfo.fontFamily || "N/A")); 
        logToPanel("  TextDocument Font: " + (textDocument ? textDocument.font : "N/A"));

        return JSON.stringify({
            status: "success", message: "Layer properties updated successfully",
            layer: returnLayerInfo
        }, null, 2);
    } catch (error) {
        // Error handling remains similar, but add more specific checks if needed
        return JSON.stringify({ status: "error", message: error.toString() }, null, 2);
    }
}

/**
 * Sets a keyframe for a specific property on a layer.
 * Indices are 1-based for After Effects collections.
 * @param {number} compIndex - The index of the composition (1-based).
 * @param {number} layerIndex - The index of the layer within the composition (1-based).
 * @param {string} propertyName - The name of the property (e.g., "Position", "Scale", "Rotation", "Opacity").
 * @param {number} timeInSeconds - The time (in seconds) for the keyframe.
 * @param {any} value - The value for the keyframe (e.g., [x, y] for Position, [w, h] for Scale, angle for Rotation, percentage for Opacity).
 * @returns {string} JSON string indicating success or error.
 */
function setLayerKeyframe(compIndex, layerIndex, propertyName, timeInSeconds, value) {
    try {
        // Use 1-based indices as per After Effects API
        var comp = app.project.items[compIndex];
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, message: "Composition not found at index " + compIndex });
        }
        var layer = comp.layers[layerIndex];
        if (!layer) {
            return JSON.stringify({ success: false, message: "Layer not found at index " + layerIndex + " in composition '" + comp.name + "'"});
        }

        var transformGroup = layer.property("Transform");
        if (!transformGroup) {
             return JSON.stringify({ success: false, message: "Transform properties not found for layer '" + layer.name + "' (type: " + layer.matchName + ")." });
        }

        var property = transformGroup.property(propertyName);
        if (!property) {
            // Check other common property groups if not in Transform
             if (layer.property("Effects") && layer.property("Effects").property(propertyName)) {
                 property = layer.property("Effects").property(propertyName);
             } else if (layer.property("Text") && layer.property("Text").property(propertyName)) {
                 property = layer.property("Text").property(propertyName);
            } // Add more groups if needed (e.g., Masks, Shapes)

            if (!property) {
                 return JSON.stringify({ success: false, message: "Property '" + propertyName + "' not found on layer '" + layer.name + "'." });
            }
        }


        // Ensure the property can be keyframed
        if (!property.canVaryOverTime) {
             return JSON.stringify({ success: false, message: "Property '" + propertyName + "' cannot be keyframed." });
        }

        // Make sure the property is enabled for keyframing
        if (property.numKeys === 0 && !property.isTimeVarying) {
             property.setValueAtTime(comp.time, property.value); // Set initial keyframe if none exist
        }


        property.setValueAtTime(timeInSeconds, value);

        return JSON.stringify({ success: true, message: "Keyframe set for '" + propertyName + "' on layer '" + layer.name + "' at " + timeInSeconds + "s." });
    } catch (e) {
        return JSON.stringify({ success: false, message: "Error setting keyframe: " + e.toString() + " (Line: " + e.line + ")" });
    }
}


/**
 * Sets an expression for a specific property on a layer.
 * @param {number} compIndex - The index of the composition (1-based).
 * @param {number} layerIndex - The index of the layer within the composition (1-based).
 * @param {string} propertyName - The name of the property (e.g., "Position", "Scale", "Rotation", "Opacity").
 * @param {string} expressionString - The JavaScript expression string. Use "" to remove expression.
 * @returns {string} JSON string indicating success or error.
 */
function setLayerExpression(compIndex, layerIndex, propertyName, expressionString) {
    try {
         // Adjust indices to be 0-based for ExtendScript arrays
        var comp = app.project.items[compIndex];
         if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({ success: false, message: "Composition not found at index " + compIndex });
        }
        var layer = comp.layers[layerIndex];
         if (!layer) {
            return JSON.stringify({ success: false, message: "Layer not found at index " + layerIndex + " in composition '" + comp.name + "'"});
        }

        var transformGroup = layer.property("Transform");
         if (!transformGroup) {
             // Allow expressions on non-transformable layers if property exists elsewhere
             // return JSON.stringify({ success: false, message: "Transform properties not found for layer '" + layer.name + "' (type: " + layer.matchName + ")." });
        }

        var property = transformGroup ? transformGroup.property(propertyName) : null;
         if (!property) {
            // Check other common property groups if not in Transform
             if (layer.property("Effects") && layer.property("Effects").property(propertyName)) {
                 property = layer.property("Effects").property(propertyName);
             } else if (layer.property("Text") && layer.property("Text").property(propertyName)) {
                 property = layer.property("Text").property(propertyName);
             } // Add more groups if needed

            if (!property) {
                 return JSON.stringify({ success: false, message: "Property '" + propertyName + "' not found on layer '" + layer.name + "'." });
            }
        }

        if (!property.canSetExpression) {
            return JSON.stringify({ success: false, message: "Property '" + propertyName + "' does not support expressions." });
        }

        property.expression = expressionString;

        var action = expressionString === "" ? "removed" : "set";
        return JSON.stringify({ success: true, message: "Expression " + action + " for '" + propertyName + "' on layer '" + layer.name + "'." });
    } catch (e) {
        return JSON.stringify({ success: false, message: "Error setting expression: " + e.toString() + " (Line: " + e.line + ")" });
    }
}

// --- applyEffect/applyEffectTemplate helpers ---
function fxListOwnKeys(obj) {
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

function fxHasOwnEntries(obj) {
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

function fxParseNumericId(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    var parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        return null;
    }
    return parsed;
}

function fxGetCompId(comp) {
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

function fxGetLayerId(layer) {
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

function fxResolveComposition(args) {
    var compId = fxParseNumericId(args.compId);
    var compName = args.compName || args.compositionName;
    var compIndex = args.compIndex;
    var i;

    if (compId !== null) {
        for (i = 1; i <= app.project.numItems; i++) {
            var byId = app.project.item(i);
            if (byId instanceof CompItem && fxGetCompId(byId) === compId) {
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

function fxResolveLayer(comp, args) {
    var layerId = fxParseNumericId(args.layerId);
    var layerName = args.layerName;
    var layerIndex = args.layerIndex;
    var j;

    if (layerId !== null) {
        for (j = 1; j <= comp.numLayers; j++) {
            var byId = comp.layer(j);
            if (fxGetLayerId(byId) === layerId) {
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

function fxPushUnique(targetArray, value) {
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

function fxAddEffectWithFallback(layer, effectName, effectMatchName) {
    var candidates = [];
    var failures = [];

    fxPushUnique(candidates, effectMatchName);
    fxPushUnique(candidates, effectName);

    var isRampRequest =
        effectMatchName === "ADBE Ramp" ||
        effectName === "ADBE Ramp" ||
        effectName === "Ramp" ||
        effectName === "Gradient Ramp";

    if (isRampRequest) {
        fxPushUnique(candidates, "ADBE Ramp");
        fxPushUnique(candidates, "Ramp");
        fxPushUnique(candidates, "ADBE 4ColorGradient");
        fxPushUnique(candidates, "ADBE 4 Color Gradient");
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

// --- applyEffect (from applyEffect.jsx) ---
function applyEffect(args) {
    try {
        var effectName = args.effectName;
        var effectMatchName = args.effectMatchName;
        var presetPath = args.presetPath;
        var effectSettings = args.effectSettings || {};

        if (!effectName && !effectMatchName && !presetPath) {
            throw new Error("You must specify either effectName, effectMatchName, or presetPath");
        }

        var comp = fxResolveComposition(args);
        var layer = fxResolveLayer(comp, args);
        var effectResult;

        if (presetPath) {
            var presetFile = new File(presetPath);
            if (!presetFile.exists) {
                throw new Error("Effect preset file not found: " + presetPath);
            }

            layer.applyPreset(presetFile);
            effectResult = {
                type: "preset",
                name: presetPath.split("/").pop().split("\\").pop(),
                applied: true
            };
        } else {
            var added = fxAddEffectWithFallback(layer, effectName, effectMatchName);
            effectResult = {
                type: "effect",
                name: added.effect.name,
                matchName: added.effect.matchName,
                index: added.effect.propertyIndex,
                usedIdentifier: added.identifier
            };
            applyEffectSettings(added.effect, effectSettings);
        }

        return JSON.stringify({
            status: "success",
            message: "Effect applied successfully",
            effect: effectResult,
            layer: {
                name: layer.name,
                index: layer.index,
                id: fxGetLayerId(layer)
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
    if (!fxHasOwnEntries(settings)) {
        return;
    }

    var settingKeys = fxListOwnKeys(settings);
    for (var x = 0; x < settingKeys.length; x++) {
        var propName = settingKeys[x];
        try {
            var property = null;
            try {
                property = effect.property(propName);
            } catch (e) {
                for (var i = 1; i <= effect.numProperties; i++) {
                    var prop = effect.property(i);
                    if (prop.name === propName) {
                        property = prop;
                        break;
                    }
                }
            }
            if (property && property.setValue) {
                property.setValue(settings[propName]);
            }
        } catch (e2) {
            $.writeln("Error setting effect property '" + propName + "': " + e2.toString());
        }
    }
}

function fxApplyTemplateSettings(effect, settings) {
    if (!settings) {
        return;
    }
    var keys = fxListOwnKeys(settings);
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

function fxAddTemplateEffectWithFallback(layer, primaryMatchName, fallbackMatchNames) {
    var candidates = [];
    var failures = [];
    fxPushUnique(candidates, primaryMatchName);

    if (fallbackMatchNames && fallbackMatchNames.length) {
        for (var i = 0; i < fallbackMatchNames.length; i++) {
            fxPushUnique(candidates, fallbackMatchNames[i]);
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

// --- applyEffectTemplate (from applyEffectTemplate.jsx) ---
function applyEffectTemplate(args) {
    try {
        var templateName = args.templateName;
        var customSettings = args.customSettings || {};

        if (!templateName) {
            throw new Error("You must specify a templateName");
        }

        var comp = fxResolveComposition(args);
        var layer = fxResolveLayer(comp, args);

        var templates = {
            "gaussian-blur": {
                effects: [
                    {
                        effectMatchName: "ADBE Gaussian Blur 2",
                        settings: { "Blurriness": customSettings.blurriness || 20 }
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

        var template = templates[templateName];
        if (!template) {
            var availableTemplates = fxListOwnKeys(templates).join(", ");
            throw new Error("Template '" + templateName + "' not found. Available templates: " + availableTemplates);
        }

        var appliedEffects = [];
        var effects = template.effects || [];
        for (var i = 0; i < effects.length; i++) {
            var effectData = effects[i];
            var added = fxAddTemplateEffectWithFallback(layer, effectData.effectMatchName, effectData.fallbackMatchNames || []);
            fxApplyTemplateSettings(added.effect, effectData.settings || {});
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
                id: fxGetLayerId(layer)
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

function fxHasExplicitLayerTarget(args) {
    return args.layerId !== undefined ||
        args.layerName !== undefined ||
        args.layerIndex !== undefined;
}

function fxResolveProbeLayer(comp, args) {
    if (fxHasExplicitLayerTarget(args)) {
        return {
            layer: fxResolveLayer(comp, args),
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

function fxKnownEffectsCatalog() {
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

function fxProbeEffect(layer, entry) {
    var candidates = [];
    var failures = [];
    fxPushUnique(candidates, entry.matchName);
    fxPushUnique(candidates, entry.name);

    if (entry.matchName === "ADBE Ramp") {
        fxPushUnique(candidates, "Ramp");
        fxPushUnique(candidates, "ADBE 4ColorGradient");
        fxPushUnique(candidates, "ADBE 4 Color Gradient");
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

function fxSerializeValue(value) {
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
            arr.push(fxSerializeValue(value[i]));
        }
        return arr;
    }
    try {
        return value.toString();
    } catch (_e) {}
    return null;
}

function fxDescribeEffectProperties(effect) {
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
            row.currentValue = fxSerializeValue(prop.value);
        } catch (_valueErr) {}

        properties.push(row);
    }

    return properties;
}

function listSupportedEffects(args) {
    var probeContext = null;

    try {
        var options = args || {};
        var includeUnavailable = options.includeUnavailable === true;
        var comp = fxResolveComposition(options);
        probeContext = fxResolveProbeLayer(comp, options);
        var probeLayer = probeContext.layer;
        var catalog = fxKnownEffectsCatalog();
        var effects = [];
        var availableCount = 0;
        var unavailableCount = 0;

        for (var i = 0; i < catalog.length; i++) {
            var entry = catalog[i];
            var probe = fxProbeEffect(probeLayer, entry);
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
                id: fxGetCompId(comp),
                name: comp.name
            },
            probeLayer: {
                id: fxGetLayerId(probeLayer),
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

        var comp = fxResolveComposition(options);
        probeContext = fxResolveProbeLayer(comp, options);
        var layer = probeContext.layer;
        added = fxAddEffectWithFallback(layer, effectName, effectMatchName);
        var effect = added.effect;
        var properties = fxDescribeEffectProperties(effect);

        return JSON.stringify({
            status: "success",
            composition: {
                id: fxGetCompId(comp),
                name: comp.name
            },
            layer: {
                id: fxGetLayerId(layer),
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

// --- End of Function Definitions ---

// --- Bridge test function to verify communication and effects application ---
function bridgeTestEffects(args) {
    try {
        var compIndex = (args && args.compIndex) ? args.compIndex : 1;
        var layerIndex = (args && args.layerIndex) ? args.layerIndex : 1;

        // Apply a light Gaussian Blur
        var blurRes = JSON.parse(applyEffect({
            compIndex: compIndex,
            layerIndex: layerIndex,
            effectMatchName: "ADBE Gaussian Blur 2",
            effectSettings: { "Blurriness": 5 }
        }));

        // Apply a simple drop shadow via template
        var shadowRes = JSON.parse(applyEffectTemplate({
            compIndex: compIndex,
            layerIndex: layerIndex,
            templateName: "drop-shadow"
        }));

        return JSON.stringify({
            status: "success",
            message: "Bridge test effects applied.",
            results: [blurRes, shadowRes]
        }, null, 2);
    } catch (e) {
        return JSON.stringify({ status: "error", message: e.toString() }, null, 2);
    }
}

// JSON polyfill for ExtendScript (when JSON is undefined)
if (typeof JSON === "undefined") {
    JSON = {};
}
if (typeof JSON.parse !== "function") {
    JSON.parse = function (text) {
        // Safe-ish fallback for trusted input (our own command file)
        return eval("(" + text + ")");
    };
}
if (typeof JSON.stringify !== "function") {
    (function () {
        function esc(str) {
            return (str + "")
                .replace(/\\/g, "\\\\")
                .replace(/"/g, '\\"')
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                .replace(/\t/g, "\\t");
        }
        function toJSON(val) {
            if (val === null) return "null";
            var t = typeof val;
            if (t === "number" || t === "boolean") return String(val);
            if (t === "string") return '"' + esc(val) + '"';
            if (val instanceof Array) {
                var a = [];
                for (var i = 0; i < val.length; i++) a.push(toJSON(val[i]));
                return "[" + a.join(",") + "]";
            }
            if (t === "object") {
                var props = [];
                for (var k in val) {
                    if (val.hasOwnProperty(k) && typeof val[k] !== "function" && typeof val[k] !== "undefined") {
                        props.push('"' + esc(k) + '":' + toJSON(val[k]));
                    }
                }
                return "{" + props.join(",") + "}";
            }
            return "null";
        }
        JSON.stringify = function (value, _replacer, _space) {
            return toJSON(value);
        };
    })();
}

// Create a dockable panel when executed from ScriptUI Panels.
// Fallback to a floating palette when launched as a normal script.
var panel = (this instanceof Panel)
    ? this
    : new Window("palette", "MCP Bridge Auto", undefined, { resizeable: true });
var isDockablePanel = panel instanceof Panel;
if (isDockablePanel) {
    panel.text = "MCP Bridge Auto";
}
panel.orientation = "column";
panel.alignChildren = ["fill", "top"];
panel.spacing = 10;
panel.margins = 16;

// Status display
var statusText = panel.add("statictext", undefined, "Waiting for commands...");
statusText.alignment = ["fill", "top"];

// Add log area
var logPanel = panel.add("panel", undefined, "Command Log");
logPanel.orientation = "column";
logPanel.alignChildren = ["fill", "fill"];
var logText = logPanel.add("edittext", undefined, "", {multiline: true, readonly: true});
logText.preferredSize.height = 200;

// Auto-run checkbox
var autoRunCheckbox = panel.add("checkbox", undefined, "Auto-run commands");
autoRunCheckbox.value = true;

// Check interval (ms)
var checkInterval = 2000;
var isChecking = false;
var permissionStateKnown = false;
var hasFileNetworkPermission = false;
var hasShownPermissionDialog = false;
var autoRunValueBeforePermissionLock = autoRunCheckbox.value;
var commandCheckerTaskId = 0;

function isControlValid(control) {
    try {
        if (!control) return false;
        var _visible = control.visible;
        return true;
    } catch (_e) {
        return false;
    }
}

function setStatus(message) {
    try {
        if (isControlValid(statusText)) {
            statusText.text = message;
        }
    } catch (_e) {}
}

function safePanelUpdate() {
    try {
        panel.update();
    } catch (_e) {}
}

function getBridgeFolderPath() {
    return Folder.myDocuments.fsName + "/ae-mcp-bridge";
}

function ensureBridgeFolder() {
    var bridgeFolder = new Folder(getBridgeFolderPath());
    if (!bridgeFolder.exists) {
        if (!bridgeFolder.create()) {
            throw new Error("Unable to create bridge folder: " + bridgeFolder.fsName);
        }
    }
    return bridgeFolder;
}

// Command file path - use Documents folder for reliable access
function getCommandFilePath() {
    var bridgeFolder = ensureBridgeFolder();
    return bridgeFolder.fsName + "/ae_command.json";
}

// Result file path - use Documents folder for reliable access
function getResultFilePath() {
    var bridgeFolder = ensureBridgeFolder();
    return bridgeFolder.fsName + "/ae_mcp_result.json";
}

function hasFileNetworkAccessPermission() {
    var probeFile = null;
    try {
        var bridgeFolder = ensureBridgeFolder();
        probeFile = new File(bridgeFolder.fsName + "/.ae_mcp_permission_probe");
        probeFile.encoding = "UTF-8";
        if (!probeFile.open("w")) {
            return false;
        }
        probeFile.write("ok");
        probeFile.close();
        if (probeFile.exists) {
            probeFile.remove();
        }
        return true;
    } catch (_e) {
        try {
            if (probeFile && probeFile.opened) {
                probeFile.close();
            }
        } catch (_closeErr) {}
        return false;
    }
}

function showPermissionDialog() {
    var shouldResume = commandCheckerTaskId !== 0;
    if (shouldResume) {
        stopCommandChecker();
    }
    alert(
        "MCP Bridge Auto cannot access files/network.\n\n" +
        "Enable \"Allow Scripts to Write Files and Access Network\" in:\n" +
        "Edit > Preferences > Scripting & Expressions\n\n" +
        "After enabling, restart After Effects or reopen this panel."
    );
    if (shouldResume) {
        startCommandChecker();
    }
}

function isModalDialogError(error) {
    var message = "";
    try {
        message = (error && error.toString) ? error.toString() : ("" + error);
    } catch (_e) {
        return false;
    }
    var normalized = message.toLowerCase();
    return normalized.indexOf("cannot run a script while a modal dialog") >= 0 ||
           normalized.indexOf("modal dialog") >= 0;
}

function applyPermissionState(showDialog) {
    if (!isControlValid(autoRunCheckbox) || !isControlValid(checkButton)) {
        return;
    }

    if (!hasFileNetworkPermission) {
        if (autoRunCheckbox.enabled) {
            autoRunValueBeforePermissionLock = autoRunCheckbox.value;
        }

        autoRunCheckbox.value = false;
        autoRunCheckbox.enabled = false;
        checkButton.enabled = false;
        setStatus("Permission required - Enable Scripts to Write Files and Access Network");

        if (showDialog && !hasShownPermissionDialog) {
            hasShownPermissionDialog = true;
            showPermissionDialog();
        }
        return;
    }

    var wasLocked = !autoRunCheckbox.enabled || !checkButton.enabled;
    autoRunCheckbox.enabled = true;
    checkButton.enabled = true;
    if (wasLocked) {
        autoRunCheckbox.value = autoRunValueBeforePermissionLock;
        hasShownPermissionDialog = false;
        logToPanel("File/network access detected. Controls re-enabled.");
    }
    setStatus("Ready - Auto-run is " + (autoRunCheckbox.value ? "ON" : "OFF"));
}

function refreshPermissionState(showDialog) {
    var granted = hasFileNetworkAccessPermission();
    if (!permissionStateKnown || granted !== hasFileNetworkPermission) {
        permissionStateKnown = true;
        hasFileNetworkPermission = granted;
        if (granted) {
            logToPanel("File/network access is enabled.");
        } else {
            logToPanel("File/network access is disabled.");
        }
    }
    applyPermissionState(showDialog);
    return hasFileNetworkPermission;
}

// Functions for each script type
function getProjectInfo() {
    var project = app.project;
    var result = {
        projectName: project.file ? project.file.name : "Untitled Project",
        path: project.file ? project.file.fsName : "",
        numItems: project.numItems,
        bitsPerChannel: project.bitsPerChannel,
        timeMode: project.timeDisplayType === TimeDisplayType.FRAMES ? "Frames" : "Timecode",
        items: []
    };

    // Count item types
    var countByType = {
        compositions: 0,
        footage: 0,
        folders: 0,
        solids: 0
    };

    // Get item information (limited for performance)
    for (var i = 1; i <= Math.min(project.numItems, 50); i++) {
        var item = project.item(i);
        var itemType = "";
        
        if (item instanceof CompItem) {
            itemType = "Composition";
            countByType.compositions++;
        } else if (item instanceof FolderItem) {
            itemType = "Folder";
            countByType.folders++;
        } else if (item instanceof FootageItem) {
            if (item.mainSource instanceof SolidSource) {
                itemType = "Solid";
                countByType.solids++;
            } else {
                itemType = "Footage";
                countByType.footage++;
            }
        }
        
        result.items.push({
            id: item.id,
            name: item.name,
            type: itemType
        });
    }
    
    result.itemCounts = countByType;

    // Include active composition metadata if available
    if (app.project.activeItem instanceof CompItem) {
        var ac = app.project.activeItem;
        result.activeComp = {
            id: ac.id,
            name: ac.name,
            width: ac.width,
            height: ac.height,
            duration: ac.duration,
            frameRate: ac.frameRate,
            numLayers: ac.numLayers
        };
    }

    return JSON.stringify(result, null, 2);
}

function listCompositions() {
    var project = app.project;
    var result = {
        compositions: []
    };
    
    // Loop through items in the project
    for (var i = 1; i <= project.numItems; i++) {
        var item = project.item(i);
        
        // Check if the item is a composition
        if (item instanceof CompItem) {
            result.compositions.push({
                id: item.id,
                name: item.name,
                duration: item.duration,
                frameRate: item.frameRate,
                width: item.width,
                height: item.height,
                numLayers: item.numLayers
            });
        }
    }
    
    return JSON.stringify(result, null, 2);
}

function getLayerInfo() {
    var project = app.project;
    var result = {
        layers: []
    };
    
    // Get the active composition
    var activeComp = null;
    if (app.project.activeItem instanceof CompItem) {
        activeComp = app.project.activeItem;
    } else {
        return JSON.stringify({ error: "No active composition" }, null, 2);
    }
    
    // Loop through layers in the active composition
    for (var i = 1; i <= activeComp.numLayers; i++) {
        var layer = activeComp.layer(i);
        var layerInfo = {
            id: fxGetLayerId(layer),
            index: layer.index,
            name: layer.name,
            enabled: layer.enabled,
            locked: layer.locked,
            inPoint: layer.inPoint,
            outPoint: layer.outPoint
        };
        
        result.layers.push(layerInfo);
    }
    
    return JSON.stringify(result, null, 2);
}

// Execute command
function executeCommand(command, args) {
    var result = "";
    
    logToPanel("Executing command: " + command);
    setStatus("Running: " + command);
    safePanelUpdate();
    
    try {
        logToPanel("Attempting to execute: " + command); // Log before switch
        // Use a switch statement for clarity
        switch (command) {
            case "getProjectInfo":
                result = getProjectInfo();
                break;
            case "listCompositions":
                result = listCompositions();
                break;
            case "getLayerInfo":
                result = getLayerInfo();
                break;
            case "createComposition":
                logToPanel("Calling createComposition function...");
                result = createComposition(args);
                logToPanel("Returned from createComposition.");
                break;
            case "createTextLayer":
                logToPanel("Calling createTextLayer function...");
                result = createTextLayer(args);
                logToPanel("Returned from createTextLayer.");
                break;
            case "createShapeLayer":
                logToPanel("Calling createShapeLayer function...");
                result = createShapeLayer(args);
                logToPanel("Returned from createShapeLayer. Result type: " + typeof result);
                break;
            case "createSolidLayer":
                logToPanel("Calling createSolidLayer function...");
                result = createSolidLayer(args);
                logToPanel("Returned from createSolidLayer.");
                break;
            case "setLayerProperties":
                logToPanel("Calling setLayerProperties function...");
                result = setLayerProperties(args);
                logToPanel("Returned from setLayerProperties.");
                break;
            case "setLayerKeyframe":
                logToPanel("Calling setLayerKeyframe function...");
                result = setLayerKeyframe(args.compIndex, args.layerIndex, args.propertyName, args.timeInSeconds, args.value);
                logToPanel("Returned from setLayerKeyframe.");
                break;
            case "setLayerExpression":
                logToPanel("Calling setLayerExpression function...");
                result = setLayerExpression(args.compIndex, args.layerIndex, args.propertyName, args.expressionString);
                logToPanel("Returned from setLayerExpression.");
                break;
            case "applyEffect":
                logToPanel("Calling applyEffect function...");
                result = applyEffect(args);
                logToPanel("Returned from applyEffect.");
                break;
            case "applyEffectTemplate":
                logToPanel("Calling applyEffectTemplate function...");
                result = applyEffectTemplate(args);
                logToPanel("Returned from applyEffectTemplate.");
                break;
            case "listSupportedEffects":
                logToPanel("Calling listSupportedEffects function...");
                result = listSupportedEffects(args);
                logToPanel("Returned from listSupportedEffects.");
                break;
            case "describeEffect":
                logToPanel("Calling describeEffect function...");
                result = describeEffect(args);
                logToPanel("Returned from describeEffect.");
                break;
            case "bridgeTestEffects":
                logToPanel("Calling bridgeTestEffects function...");
                result = bridgeTestEffects(args);
                logToPanel("Returned from bridgeTestEffects.");
                break;
            default:
                result = JSON.stringify({ error: "Unknown command: " + command });
        }
        logToPanel("Execution finished for: " + command); // Log after switch
        
        // Save the result (ensure result is always a string)
        logToPanel("Preparing to write result file...");
        var resultString = (typeof result === 'string') ? result : JSON.stringify(result);
        
        // Try to parse the result as JSON to add a timestamp
        try {
            var resultObj = JSON.parse(resultString);
            // Add a timestamp to help identify if we're getting fresh results
            resultObj._responseTimestamp = new Date().toISOString();
            resultObj._commandExecuted = command;
            resultString = JSON.stringify(resultObj, null, 2);
            logToPanel("Added timestamp to result JSON for tracking freshness.");
        } catch (parseError) {
            // If it's not valid JSON, append the timestamp as a comment
            logToPanel("Could not parse result as JSON to add timestamp: " + parseError.toString());
            // We'll still continue with the original string
        }
        
        var resultFile = new File(getResultFilePath());
        resultFile.encoding = "UTF-8"; // Ensure UTF-8 encoding
        logToPanel("Opening result file for writing...");
        var opened = resultFile.open("w");
        if (!opened) {
            logToPanel("ERROR: Failed to open result file for writing: " + resultFile.fsName);
            throw new Error("Failed to open result file for writing.");
        }
        logToPanel("Writing to result file...");
        var written = resultFile.write(resultString);
        if (!written) {
             logToPanel("ERROR: Failed to write to result file (write returned false): " + resultFile.fsName);
             // Still try to close, but log the error
        }
        logToPanel("Closing result file...");
        var closed = resultFile.close();
         if (!closed) {
             logToPanel("ERROR: Failed to close result file: " + resultFile.fsName);
             // Continue, but log the error
        }
        logToPanel("Result file write process complete.");
        
        logToPanel("Command completed successfully: " + command); // Changed log message
        setStatus("Command completed: " + command);
        
        // Update command file status
        logToPanel("Updating command status to completed...");
        updateCommandStatus("completed");
        logToPanel("Command status updated.");
        
    } catch (error) {
        if (isModalDialogError(error)) {
            logToPanel("Modal dialog detected. Command will be retried automatically.");
            setStatus("Paused: modal dialog is open. Waiting to retry...");
            try {
                updateCommandStatus("pending");
            } catch (_retryStateErr) {}
            return;
        }

        var errorMsg = "ERROR in executeCommand for '" + command + "': " + error.toString() + (error.line ? " (line: " + error.line + ")" : "");
        logToPanel(errorMsg); // Log detailed error
        setStatus("Error: " + error.toString());
        
        // Write detailed error to result file
        try {
            logToPanel("Attempting to write ERROR to result file...");
            var errorResult = JSON.stringify({ 
                status: "error", 
                command: command,
                message: error.toString(),
                line: error.line,
                fileName: error.fileName
            });
            var errorFile = new File(getResultFilePath());
            errorFile.encoding = "UTF-8";
            if (errorFile.open("w")) {
                errorFile.write(errorResult);
                errorFile.close();
                logToPanel("Successfully wrote ERROR to result file.");
            } else {
                 logToPanel("CRITICAL ERROR: Failed to open result file to write error!");
            }
        } catch (writeError) {
             logToPanel("CRITICAL ERROR: Failed to write error to result file: " + writeError.toString());
        }
        
        // Update command file status even after error
        logToPanel("Updating command status to error...");
        updateCommandStatus("error");
        logToPanel("Command status updated to error.");
    }
}

// Update command file status
function updateCommandStatus(status) {
    try {
        var commandFile = new File(getCommandFilePath());
        if (commandFile.exists) {
            commandFile.open("r");
            var content = commandFile.read();
            commandFile.close();
            
            if (content) {
                var commandData = JSON.parse(content);
                commandData.status = status;
                
                commandFile.open("w");
                commandFile.write(JSON.stringify(commandData, null, 2));
                commandFile.close();
            }
        }
    } catch (e) {
        logToPanel("Error updating command status: " + e.toString());
    }
}

// Log message to panel
function logToPanel(message) {
    var timestamp = new Date().toLocaleTimeString();
    try {
        if (!isControlValid(logText)) {
            return;
        }
        logText.text = timestamp + ": " + message + "\n" + logText.text;
    } catch (_e) {}
}

// Check for new commands
function checkForCommands() {
    if (!isControlValid(autoRunCheckbox) || !isControlValid(checkButton)) {
        stopCommandChecker();
        return;
    }
    if (isChecking) return;
    if (!refreshPermissionState(false)) return;
    if (!autoRunCheckbox.value) {
        setStatus("Ready - Auto-run is OFF");
        return;
    }
    
    isChecking = true;
    
    try {
        var commandFile = new File(getCommandFilePath());
        if (commandFile.exists) {
            commandFile.open("r");
            var content = commandFile.read();
            commandFile.close();
            
            if (content) {
                var commandData = (typeof JSON !== "undefined" && JSON.parse)
                    ? JSON.parse(content)
                    : eval("(" + content + ")");
                
                // Only execute pending commands
                if (commandData.status === "pending") {
                    // Update status to running
                    updateCommandStatus("running");
                    
                    // Execute the command
                    executeCommand(commandData.command, commandData.args || {});
                }
            }
        }
    } catch (e) {
        logToPanel("Error checking for commands: " + e.toString());
    } finally {
        isChecking = false;
    }
}

// Set up timer to check for commands
function startCommandChecker() {
    stopCommandChecker();
    commandCheckerTaskId = app.scheduleTask("checkForCommands()", checkInterval, true);
}

function stopCommandChecker() {
    if (!commandCheckerTaskId) {
        return;
    }
    try {
        app.cancelTask(commandCheckerTaskId);
    } catch (_e) {}
    commandCheckerTaskId = 0;
}

// Add manual check button
var checkButton = panel.add("button", undefined, "Check for Commands Now");
checkButton.onClick = function() {
    if (!refreshPermissionState(true)) {
        return;
    }
    logToPanel("Manually checking for commands");
    checkForCommands();
};

// Log startup
logToPanel("MCP Bridge Auto started");
logToPanel("UI mode: " + (isDockablePanel ? "dockable panel" : "floating window"));
try {
    logToPanel("Command file: " + getCommandFilePath());
} catch (pathError) {
    logToPanel("Command file path unavailable: " + pathError.toString());
}
refreshPermissionState(true);

// Start the command checker
startCommandChecker();

panel.onClose = function () {
    stopCommandChecker();
    return true;
};

// Keep layout responsive for both docked panel and floating window.
panel.onResizing = panel.onResize = function () {
    this.layout.resize();
};
panel.layout.layout(true);

// Show only when using floating window mode.
if (!isDockablePanel) {
    panel.center();
    panel.show();
}
