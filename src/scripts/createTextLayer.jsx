// createTextLayer.jsx
// Creates a new text layer in the specified composition

function createTextLayer(args) {
    try {
        // Extract parameters from args
        var compName = args.compName || "";
        var text = args.text || "Text Layer";
        var position = args.position || [960, 540]; // Default to center
        var fontSize = args.fontSize || 72;
        var color = args.color || [1, 1, 1]; // Default to white
        var startTime = args.startTime || 0;
        var duration = args.duration || 5; // Default 5 seconds
        var fontFamily = args.fontFamily || "Arial";
        var alignment = args.alignment || "center"; // "left", "center", "right"
        
        // Find the composition by name
        var comp = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof CompItem && item.name === compName) {
                comp = item;
                break;
            }
        }
        
        // If no composition was found by name, use the active composition
        if (!comp) {
            if (app.project.activeItem instanceof CompItem) {
                comp = app.project.activeItem;
            } else {
                throw new Error("No composition found with name '" + compName + "' and no active composition");
            }
        }
        
        // Create the text layer
        var textLayer = comp.layers.addText(text);
        
        // Get text properties
        var textProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document");
        var textDocument = textProp.value;
        
        // Set font size and color
        textDocument.fontSize = fontSize;
        textDocument.fillColor = color;
        textDocument.font = fontFamily;
        
        // Set text alignment
        if (alignment === "left") {
            textDocument.justification = ParagraphJustification.LEFT_JUSTIFY;
        } else if (alignment === "center") {
            textDocument.justification = ParagraphJustification.CENTER_JUSTIFY;
        } else if (alignment === "right") {
            textDocument.justification = ParagraphJustification.RIGHT_JUSTIFY;
        }
        
        // Update the text property
        textProp.setValue(textDocument);
        
        // Set position
        textLayer.property("Position").setValue(position);
        
        // Set timing
        textLayer.startTime = startTime;
        if (duration > 0) {
            textLayer.outPoint = startTime + duration;
        }
        
        // Return success with layer details
        return JSON.stringify({
            status: "success",
            message: "Text layer created successfully",
            layer: {
                name: textLayer.name,
                index: textLayer.index,
                id: getLayerId(textLayer),
                type: "text",
                inPoint: textLayer.inPoint,
                outPoint: textLayer.outPoint,
                position: textLayer.property("Position").value
            }
        }, null, 2);
    } catch (error) {
        // Return error message
        return JSON.stringify({
            status: "error",
            message: error.toString()
        }, null, 2);
    }
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
        } catch (e) {
            // Handle parsing error
            $.write(JSON.stringify({
                status: "error",
                message: "Failed to parse arguments: " + e.toString()
            }, null, 2));
        }
    }
}

// Run the function and write the result
var result = createTextLayer(args);

// Write the result so it can be captured by the Node.js process
$.write(result); 
