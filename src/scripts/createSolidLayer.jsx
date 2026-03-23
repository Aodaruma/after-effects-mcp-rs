// createSolidLayer.jsx
// Creates a new solid layer in the specified composition

function createSolidLayer(args) {
    try {
        // Extract parameters from args
        var compName = args.compName || "";
        var color = args.color || [1, 1, 1]; // Default to white
        var name = args.name || "Solid Layer";
        var position = args.position || [960, 540]; // Default to center
        var size = args.size; // Width, Height (if null, will use comp size)
        var startTime = args.startTime || 0;
        var duration = args.duration || 5; // Default 5 seconds
        var isAdjustment = args.isAdjustment || false; // Make it an adjustment layer?
        
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
        
        // If size is not specified, use composition size
        if (!size) {
            size = [comp.width, comp.height];
        }
        
        // Create a solid layer
        var solidLayer;
        
        if (isAdjustment) {
            // Create an adjustment layer
            solidLayer = comp.layers.addSolid([0, 0, 0], name, size[0], size[1], 1);
            solidLayer.adjustmentLayer = true;
        } else {
            // Create a regular solid layer
            solidLayer = comp.layers.addSolid(
                color,
                name,
                size[0],
                size[1],
                1 // Pixel aspect ratio
            );
        }
        
        // Set position
        solidLayer.property("Position").setValue(position);
        
        // Set timing
        solidLayer.startTime = startTime;
        if (duration > 0) {
            solidLayer.outPoint = startTime + duration;
        }
        
        // Return success with layer details
        return JSON.stringify({
            status: "success",
            message: isAdjustment ? "Adjustment layer created successfully" : "Solid layer created successfully",
            layer: {
                name: solidLayer.name,
                index: solidLayer.index,
                id: getLayerId(solidLayer),
                type: isAdjustment ? "adjustment" : "solid",
                inPoint: solidLayer.inPoint,
                outPoint: solidLayer.outPoint,
                position: solidLayer.property("Position").value,
                isAdjustment: solidLayer.adjustmentLayer
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
var result = createSolidLayer(args);

// Write the result so it can be captured by the Node.js process
$.write(result); 
