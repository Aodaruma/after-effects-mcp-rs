// getLayerInfo.jsx
// Get detailed information about layers in a composition

function getLayerInfo() {
    var project = app.project;
    var compName = undefined;
    
    // Read arguments from the file (passed by the Node.js script)
    var argsFile = new File($.fileName.replace(/[^\\\/]*$/, '') + "../temp/args.json");
    var args = {};
    if (argsFile.exists) {
        argsFile.open("r");
        var content = argsFile.read();
        argsFile.close();
        if (content) {
            try {
                args = JSON.parse(content);
                compName = args.compositionName;
            } catch (e) {
                // Handle parsing error
            }
        }
    }
    
    var result = { 
        compositions: []
    };
    
    // Find compositions and their layers
    for (var i = 1; i <= project.numItems; i++) {
        var item = project.item(i);
        if (item instanceof CompItem && (!compName || item.name === compName)) {
            var compData = {
                name: item.name,
                id: item.id,
                duration: item.duration,
                frameRate: item.frameRate,
                width: item.width,
                height: item.height,
                layers: []
            };
            
            // Process layers in the composition
            for (var j = 1; j <= item.numLayers; j++) {
                var layer = item.layer(j);
                var layerData = {
                    id: getLayerId(layer),
                    name: layer.name,
                    index: layer.index,
                    enabled: layer.enabled,
                    locked: layer.locked,
                    solo: layer.solo,
                    shy: layer.shy,
                    type: determineLayerType(layer),
                    inPoint: layer.inPoint,
                    outPoint: layer.outPoint,
                    duration: layer.outPoint - layer.inPoint,
                    startTime: layer.startTime,
                    label: layer.label,
                    hasAudio: layer.hasAudio,
                    hasVideo: layer.hasVideo,
                    position: layer.position.value,
                    effects: getEffects(layer),
                    properties: getKeyProperties(layer)
                };
                
                compData.layers.push(layerData);
            }
            
            result.compositions.push(compData);
            
            if (compName) {
                break; // If we found the specific comp, no need to continue
            }
        }
    }
    
    return JSON.stringify(result, null, 2);
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

function determineLayerType(layer) {
    if (!layer.source) {
        return "Null";
    }
    
    if (layer.source instanceof CompItem) {
        return "Composition";
    }
    
    if (layer.source instanceof FootageItem) {
        if (layer.source.mainSource instanceof SolidSource) {
            return "Solid";
        }
        
        if (layer.source.mainSource instanceof FileSource) {
            if (layer.source.hasVideo) {
                return "Video";
            }
            if (layer.source.hasAudio) {
                return "Audio";
            }
            
            // Check file extension for image types
            var fileName = layer.source.file.name.toLowerCase();
            if (/\.(png|jpg|jpeg|gif|tiff|tif|bmp|psd|ai|eps)$/.test(fileName)) {
                return "Image";
            }
        }
        
        if (layer.source.mainSource instanceof PlaceholderSource) {
            return "Placeholder";
        }
        
        return "Footage";
    }
    
    if (layer.text) {
        return "Text";
    }
    
    if (layer.name.indexOf("Light") === 0) {
        return "Light";
    }
    
    if (layer.name.indexOf("Camera") === 0) {
        return "Camera";
    }
    
    return "Unknown";
}

function getEffects(layer) {
    var effects = [];
    
    if (!layer.effect || layer.effect.numProperties === 0) {
        return effects;
    }
    
    for (var i = 1; i <= layer.effect.numProperties; i++) {
        var effect = layer.effect(i);
        effects.push({
            name: effect.name,
            matchName: effect.matchName,
            enabled: effect.enabled
        });
    }
    
    return effects;
}

function getKeyProperties(layer) {
    var properties = [];
    
    // Common properties to check
    var propNames = [
        "Opacity", "Position", "Scale", "Rotation",
        "Anchor Point", "Transform", "Effects"
    ];
    
    for (var i = 0; i < propNames.length; i++) {
        try {
            var propName = propNames[i];
            var prop = layer.property(propName);
            
            if (prop && prop.numKeys > 0) {
                var keyframes = [];
                
                for (var k = 1; k <= prop.numKeys; k++) {
                    keyframes.push({
                        time: prop.keyTime(k),
                        value: prop.keyValue(k)
                    });
                }
                
                properties.push({
                    name: propName,
                    numKeys: prop.numKeys,
                    keyframes: keyframes
                });
            }
        } catch (e) {
            // Skip properties that don't exist or can't be accessed
        }
    }
    
    return properties;
}

// Run the function and write the result
var result = getLayerInfo();

// Write the result so it can be captured by the Node.js process
$.write(result);
