/*   
   mergeAndRedraw.js
 * (c)2025 Forward Computing and Control Pty. Ltd.
 * NSW Australia, www.forward.com.au
 * This code is not warranted to be fit for any purpose. You may only use it at your own risk.
 * This generated code may be freely used for both private and commercial use
 * provided this copyright is maintained.
 */

// mergeAndRedraw.js - Functions for merging drawing data and orchestrating redraw
// Note: Now a class to support multiple viewer instances
// Uses separate Redraw module for actual drawing operations

// MergeAndRedraw class for isolated canvas rendering per viewer
class MergeAndRedraw {
    constructor() {
        // Instance-level variables - isolated per viewer
        this.canvas = null;
        this.ctx = null;
        
        // Create isolated Redraw instance for this viewer
        this.redraw = new window.Redraw();
        
        // Drawing manager state - received from pfodWeb.js via updateState
        this.drawingManagerState = {
            drawings: [],
            drawingsData: {},
            allDrawingsReceived: false, // this is not actually used!!
            unindexedItems: {},
            indexedItems: {},
            touchZonesByCmd: {},
            allTouchZonesByCmd: {},
            drawingResponseStatus: {}
        };
        
        // Variables to track canvas size to prevent unnecessary redrawing
        this.cachedCanvasWidth = 0;
        this.cachedCanvasHeight = 0;
        this.hasCompletedFirstDraw = false;
        
        // Variables to store merged items for reference during drawing/clipping
        this.allUnindexedItems = [];
        this.allIndexedItemsByNumber = {}; // Key: numeric index, Value: array of items with that index
    }

    // Helper methods to access drawing manager data
    getUnindexedItems(drawingName) {
        return this.drawingManagerState.unindexedItems[drawingName] || [];
    }

    getIndexedItems(drawingName) {
        return this.drawingManagerState.indexedItems[drawingName] || {};
    }
    getTouchZonesByCmd(drawingName) {
        return this.drawingManagerState.touchZonesByCmd[drawingName] || {};
    }

    getDrawingResponseStatus(drawingName) {
        return this.drawingManagerState.drawingResponseStatus[drawingName] || false;
    }

    getCurrentTransform(drawingName) {
        return this.drawingManagerState.getCurrentTransform(drawingName);
    }

    getCurrentDrawingName() {
        return this.drawingManagerState.drawings.length > 0 ? this.drawingManagerState.drawings[0] : '';
    }

    // Get all touch zones by cmd - this replaces global touchZonesByCmd access
    getAllTouchZonesByCmd() {
        return this.drawingManagerState.allTouchZonesByCmd || {};
    }

    // Initialize the module
    init(config) {
        if (config.canvas) this.canvas = config.canvas;
        if (config.ctx) this.ctx = config.ctx;
        if (config.drawingViewer) this.drawingViewer = config.drawingViewer;
        
        // Initialize the Redraw module with our canvas and state
        this.redraw.init({
            canvas: this.canvas,
            ctx: this.ctx,
            drawingManagerState: this.drawingManagerState
        });
        
        console.log(`[MERGE_REDRAW] Module initialized with canvas ${this.canvas.width}x${this.canvas.height}`);
    }

    // Update the state from the drawing manager
    updateState(config) {
        if (config.drawings) this.drawingManagerState.drawings = config.drawings;
        if (config.drawingsData) this.drawingManagerState.drawingsData = config.drawingsData;
        if (config.allDrawingsReceived !== undefined) this.drawingManagerState.allDrawingsReceived = config.allDrawingsReceived; // this is not actually used!!
        if (config.unindexedItems) this.drawingManagerState.unindexedItems = config.unindexedItems;
        if (config.indexedItems) this.drawingManagerState.indexedItems = config.indexedItems;
        if (config.touchZonesByCmd) this.drawingManagerState.touchZonesByCmd = config.touchZonesByCmd;
        if (config.allTouchZonesByCmd) this.drawingManagerState.allTouchZonesByCmd = config.allTouchZonesByCmd;
        if (config.drawingResponseStatus) this.drawingManagerState.drawingResponseStatus = config.drawingResponseStatus;
        
        // Update the Redraw module state as well
        this.redraw.updateState(config);
    }

    // Public interface for canvas redraw
    redrawCanvas() {
      // Use atomic function calls for real-time state instead of stale snapshots
      const isProcessing = this.drawingViewer ? this.drawingViewer.isProcessingQueue() : false;
      const queueLength = this.drawingViewer ? this.drawingViewer.requestQueue.length : 0;
      const sentRequest = this.drawingViewer ? this.drawingViewer.sentRequest : null;
      
      if (isProcessing || queueLength > 0 || sentRequest) {
         console.log(`[MERGE_REDRAW] Skipping redraw - processing: ${isProcessing}, queue length: ${queueLength}, sentRequest: ${sentRequest?.drawingName || 'none'}`);
         return;
      }
        // Use DrawingManager state to get the current drawing data
        const mainDrawingName = this.drawingManagerState.drawings.length > 0 ? this.drawingManagerState.drawings[0] : '';

        const currentDrawingData = this.drawingManagerState.drawingsData[mainDrawingName];
        if (!currentDrawingData) return;
        
        console.log(`[MERGE_REDRAW] Starting redraw for canvas: ${mainDrawingName}, size=${this.canvas.width}x${this.canvas.height} at ${new Date().toISOString()}`);
                
        // We'll rebuild these collections during the redraw
        this.allUnindexedItems = [];
        this.allIndexedItemsByNumber = {}; // Key: numeric index, Value: array of items with that index
        this.drawingManagerState.allTouchZonesByCmd = {}; // Clear old touchZones from previous drawing

        // Mark processed drawings to avoid infinite loops
        let processedDrawings = new Set();

        console.log(`[MERGE_REDRAW] Starting to merge drawing items with unindexed and indexed items from DrawingManager`);
        
        // Set up initial transform state for the main drawing
        const initialTransform = {
            x: 0,
            y: 0,
            scale: 1.0
        };
        
        // Create the main clip region (full canvas logical size)
        const logicalCanvasWidth = currentDrawingData.data ? currentDrawingData.data.x || 50 : 50;
        const logicalCanvasHeight = currentDrawingData.data ? currentDrawingData.data.y || 50 : 50;
        const mainClipRegion = {
            x: 0,
            y: 0,
            width: logicalCanvasWidth,
            height: logicalCanvasHeight
        };
        console.log(`[MERGE_REDRAW] Created main clip region: (${mainClipRegion.x}, ${mainClipRegion.y}, ${mainClipRegion.width}, ${mainClipRegion.height})`);
        
        // Start by processing the main drawing  This will add a background rectangle
        console.log(`[MERGE_REDRAW] Processing main drawing "${mainDrawingName}" with mergeDrawingItems`);
        const mainDwg = {
                type: 'insertDwg',
                xOffset: 0,
                yOffset: 0,
                color: currentDrawingData.color,
                parentDrawingName: mainDrawingName, // itself
                drawingName: mainDrawingName,
                transform: { x: 0, y: 0, scale: 1.0 }
            };
        this.mergeDrawingItems(mainDwg, this.allUnindexedItems, this.allIndexedItemsByNumber, processedDrawings, mainClipRegion);
        
        // Report the merged results
        console.log(`[MERGE_REDRAW] After merging all drawings: ${this.allUnindexedItems.length} unindexed items, ${Object.keys(this.allIndexedItemsByNumber).length} different indices, ${Object.keys(this.drawingManagerState.allTouchZonesByCmd).length} touchZones`)
        for (let i = 0; i < this.allUnindexedItems.length; i++) {
            const item = this.allUnindexedItems[i];
            console.log(`[REDRAW] DEBUG: Unindexed item ${i}: type=${item.type}, drawingName=${item.drawingName || 'none'}, transform=(${item.transform?.x},${item.transform?.y}), scale=${item.transform?.scale}`);
        }
        
        // Only add items to draw if specifically needed for debugging
        // We don't add test rectangles for empty drawings, as they should be allowed to be empty
        if (this.allUnindexedItems.length === 0) {
            console.log(`[MERGE_REDRAW] No items to draw. Canvas will remain empty.`);
            // The test rectangle code has been removed intentionally to allow for empty canvases
        }
        
        // Debug: print allIndexedItems ordered by index
        const sortedIndexes = Object.keys(this.allIndexedItemsByNumber).map(Number).sort((a, b) => a - b);
        if (sortedIndexes.length > 0) {
            console.log(`[MERGE_REDRAW] allIndexedItems ordered by index:`);
            sortedIndexes.forEach(index => {
                const item = this.allIndexedItemsByNumber[index];
                console.log(`  Index ${index}: Type: ${item.type || 'unknown'}, Drawing: ${item.drawingName || 'unknown'}`);
            });
        } else {
            console.log(`[MERGE_REDRAW] No indexed items found.`);
        }
       
        // Now call redraw to handle the actual drawing
        return this.redraw.redrawCanvas(currentDrawingData, this.allUnindexedItems, this.allIndexedItemsByNumber);
    }

    // Calculate clipping region for an item
    calculateItemClipRegion(itemTransform, drawingWidth, drawingHeight, parentClipRegion) {
        // Calculate the item's clip region based on its transform and drawing bounds
        /**
        const x = itemTransform.x;
        const y = itemTransform.y;
        const scale = itemTransform.scale;
        
        // Apply scaling to the drawing dimensions to get the clip region size
        const width = drawingWidth * scale;
        const height = drawingHeight * scale;
        
        const itemClipRegion = {
            x: x,
            y: y,
            width: width,
            height: height
        };
        console.log(`[CLIPPING_MERGE_DWG] Item transform: (${itemTransform.x}, ${itemTransform.y}, scale=${itemTransform.scale})`);
        console.log(`[CLIPPING_MERGE_DWG] Calculated item clip region: (${x}, ${y}, ${width}, ${height})`);
        console.log(`[CLIPPING_MERGE_DWG] This is the rectangle from (${x},${y}) to (${x+width},${y+height})`);
        
        // Calculate intersection with parent clip region if provided
        if (parentClipRegion) {
            console.log(`[CLIPPING_MERGE_DWG] Calculating intersection with parent clip region: (${parentClipRegion.x}, ${parentClipRegion.y}, ${parentClipRegion.width}, ${parentClipRegion.height})`);
            console.log(`[CLIPPING_MERGE_DWG] Parent rectangle from (${parentClipRegion.x},${parentClipRegion.y}) to (${parentClipRegion.x+parentClipRegion.width},${parentClipRegion.y+parentClipRegion.height})`);
            
            // Calculate intersection bounds
            const intersectLeft = Math.max(parentClipRegion.x, itemClipRegion.x);
            const intersectTop = Math.max(parentClipRegion.y, itemClipRegion.y);
            const intersectRight = Math.min(parentClipRegion.x + parentClipRegion.width, 
                                          itemClipRegion.x + itemClipRegion.width);
            const intersectBottom = Math.min(parentClipRegion.y + parentClipRegion.height, 
                                           itemClipRegion.y + itemClipRegion.height);
            
            // Check if there's a valid intersection
            if (intersectRight > intersectLeft && intersectBottom > intersectTop) {
                itemClipRegion.x = intersectLeft;
                itemClipRegion.y = intersectTop;
                itemClipRegion.width = intersectRight - intersectLeft;
                itemClipRegion.height = intersectBottom - intersectTop;
                
                console.log(`[CLIPPING_MERGE_DWG] Intersection clip region: x:(${itemClipRegion.x}, y:${itemClipRegion.y}, width: ${itemClipRegion.width}, height: ${itemClipRegion.height})`);
            console.log(`[CLIPPING_MERGE_DWG] Intersection clip rectangle is from (${itemClipRegion.x},${itemClipRegion.y}) to (${itemClipRegion.x+itemClipRegion.width},${itemClipRegion.y+itemClipRegion.height})`);
            } else {
                console.log(`[CLIPPING_MERGE_DWG] No intersection between parent clip region and item bounds - item will be clipped completely`);
                // Set clip region to zero area if no intersection
                itemClipRegion.x = 0;
                itemClipRegion.y = 0;
                itemClipRegion.width = 0;
                itemClipRegion.height = 0;
            }
        }
        **/
        return parentClipRegion;//itemClipRegion;
    }

    /**
    transform calculations
    each items has a base offset and a scale and a clip region
    when the item is drawn, first the item's offset x scale is added to the base to the the position
    then the size is scaled by scale and the item drawn
    insertDwg's offset are different they do not change the position of the the background rectangle
    rather they move the insertDwg's items up and to left by offset * scale (for +ve offsets)
    clip regions are only updated when insertDwg processed
    
    the insertDwg arg contains the current transformation offset and scale
    the insertDwg xOffset,yOffset move the dwg items up and left by offset * scale (for +ve offsets)
    scale insertDwg by ratio of cols i.e. a 20xh inserted in a 40xhh will be scaled down by 2 i.e. x 20/40
    **/
    // Merge drawing items from a specific drawing with transforms and clipping
    // dwgTransform is the parent transform and scaling for this deg
    mergeDrawingItems(insertDwg, allUnindexedItems, allIndexedItemsByNumber, processedDrawings, parentClipRegion = null) {
       // console.log(`[MERGE_DWG] Using parent transform: (${parentTransform.x}, ${parentTransform.y}, ${parentTransform.scale}) for drawing "${drawingName}"`);
        // parent transform is base offset + scale
        // all added item first have their offset scaled by scale and then base offset added
        
        let drawingName = insertDwg.drawingName;
        console.log(`[MERGE_DWG] Beginning merge process for drawing "${drawingName}" ${JSON.stringify(insertDwg)}`);        
        // Get drawing data for dimensions and color
        const drawingData = this.drawingManagerState.drawingsData[drawingName];
        if (!drawingData || !drawingData.data) {
            console.log(`[MERGE_DWG] Drawing "${drawingName}" data not available.`);
            return;
        }
        let clipRegion = parentClipRegion;
        if (parentClipRegion) {
            console.log(`[MERGE_DWG] Using parent clip region: (${parentClipRegion.x}, ${parentClipRegion.y}, width:${parentClipRegion.width}, height:${parentClipRegion.height})`);
        } else {
            console.log(`[MERGE_DWG] No parent clip region provided, using drawing bounds for clipping`);
            const clipRegion = {
            x: 0,
            y: 0,
            width: drawingData.data.x,
            height: drawingData.data.y
          };
        }
        parentClipRegion = clipRegion;
        
        // Get drawing dimensions and properties
        const drawingWidth = drawingData.data.x || 50;
        const drawingHeight = drawingData.data.y || 50;
        const backgroundColor = drawingData.data.color || 'white';
        
        console.log(`[MERGE_DWG] Drawing "${drawingName}" has dimensions ${drawingWidth}x${drawingHeight}, color: ${backgroundColor}`);
        //console.log(`[MERGE_DWG] Parent transform for "${drawingName}":`, JSON.stringify(parentTransform));
        
        // Get items from this drawing
        const drawingUnindexedItems = this.getUnindexedItems(drawingName);
        const drawingIndexedItems = this.getIndexedItems(drawingName);
        const touchZoneItems = this.getTouchZonesByCmd(drawingName);
        
        console.log(`[MERGE_DWG] Processing ${drawingUnindexedItems.length} unindexed items, ${Object.keys(drawingIndexedItems).length} indexed items, ${Object.keys(touchZoneItems).length} touchZones from "${drawingName}"`);
        
        // Handle case where drawing has no items
        if (drawingUnindexedItems.length === 0 && Object.keys(drawingIndexedItems).length === 0) {
            console.log(`[MERGE_DWG] Drawing "${drawingName}" has no items, but will still be drawn as a rectangle with background color.`);
            if (Object.keys(drawingIndexedItems).length !== 0) {
                console.log(`[MERGE_DWG] Drawing "${drawingName}" has touchZones which will be drawn in debug mode.`);
            }    
        }
        
        
        let dwgTransform = {...insertDwg.transform}; // the current parent transform
        // adjust the scale by the ratio of the dwg.x to clip.width clip is the main dwg clip
        dwgTransform.scale = dwgTransform.scale * drawingWidth/parentClipRegion.width;
        
        console.log(`[SCALE_MERGE_DWG]  insertDwg transform: ${JSON.stringify(dwgTransform)}`);
        
        console.log(`[MERGE_DWG] For drawing: Raw dimensions: ${drawingWidth}x${drawingHeight}`);
        //console.log(`[MERGE_DWG] For drawing: Clip with scale: (${dwgTransform.x}, ${dwgTransform.y}, scale=${dwgTransform.scale})`);
        // Calculate the clip region for the nested drawing using our common function
        const dwgClipRegion = this.calculateItemClipRegion(dwgTransform, drawingWidth, drawingHeight, parentClipRegion);                   
        console.log(`[MERGE_DWG] Calculated nested drawing clip region: (${dwgClipRegion.x}, ${dwgClipRegion.y}, width:${dwgClipRegion.width}, height:${dwgClipRegion.height})`);
        
        // apply insertDwg offset move
        // update nestedTransform for  dwg offset to move dwg up and left need to include scale
         const dwg_xOffset = parseFloat(insertDwg.xOffset || 0);
         const dwg_yOffset = parseFloat(insertDwg.yOffset || 0);

        dwgTransform.x += (-dwg_xOffset) * dwgTransform.scale;
        dwgTransform.y += (-dwg_yOffset) * dwgTransform.scale;
        console.log(`[SCALE_MERGE_DWG] Using item transform for nested drawing items: (${dwgTransform.x}, ${dwgTransform.y}, ${dwgTransform.scale})`);

        // Process touchZones
        for (const cmd in touchZoneItems) {
            const touchZone = touchZoneItems[cmd];
            const processedItem = {...touchZone};
            processedItem.clipRegion = dwgClipRegion;
            // build combined transform
           const itemTransform = {...processedItem.transform};
           itemTransform.x += itemTransform.x * dwgTransform.scale + dwgTransform.x;
           itemTransform.y += itemTransform.y * dwgTransform.scale + dwgTransform.y;
           itemTransform.scale = itemTransform.scale *  dwgTransform.scale;
           processedItem.transform = itemTransform;
           // Handle touchZone
           console.log(`[MERGE_DWG] Found touchzone item for drawing "${drawingName}" at offsets (${touchZone.xOffset || 0}, ${touchZone.yOffset || 0})`);
           const touchZoneCmd = touchZone.cmd || '';
           if (touchZoneCmd.trim().length == 0) {
             console.warn(`[MERGE_DWG] Error empty touchzone cmd in drawing "${drawingName}" ${JSON.stringify(processedItem)}`);
           } else {
             if (!this.drawingManagerState.allTouchZonesByCmd[touchZoneCmd]) {
             } else {
                const currentItem = this.drawingManagerState.allTouchZonesByCmd[touchZoneCmd];
                if (currentItem.parentDrawingName !== processedItem.parentDrawingName) {
                    console.warn(`[MERGE_DWG] Error: Updating existing touchZone with cmd ${touchZoneCmd} in "${processedItem.parentDrawingName}" with item from different drawing, "${currentItem.parentDrawingName}"`);
                }
                // save current transform
                processedItem.transform = {...currentItem.transform}; // keep new data but change transform and clipRegion
                processedItem.clipRegion = {...currentItem.clipRegion};
                console.log(`[MERGE_DWG_UPDATE] Update existing touchZone with cmd ${touchZoneCmd} to ${JSON.stringify(processedItem)}`);
            }
            console.log(`[MERGE_DWG] Added touchZone to allTouchZonesByCmd  ${JSON.stringify(processedItem)}`);
            this.drawingManagerState.allTouchZonesByCmd[touchZoneCmd] = processedItem;
           }
        }
        
        // Process unindexed items
        for (let i = 0; i < drawingUnindexedItems.length; i++) {
            const item = drawingUnindexedItems[i];
            // insertDwg does not process offset like rectangle
            item.clipRegion = dwgClipRegion;
            
            console.log(`[MERGE_DWG] Processing unindexed item ${i} of type '${item.type}' in drawing "${drawingName}"`);
            console.log(`[MERGE_DWG] item: ${JSON.stringify(item)}`);
            //console.log(`[SCALE_MERGE_DWG]  parent transform: (${parentTransform.x}, ${parentTransform.y}, ${parentTransform.scale})`);
            
            if (item.type && item.type.toLowerCase() === 'insertdwg') {
                // Handle nested insertDwg
                const nestedDrawingName = item.drawingName;
                console.log(`[MERGE_DWG] Found nested insertDwg item for drawing "${nestedDrawingName}" at offsets (${item.xOffset || 0}, ${item.yOffset || 0})`);
                
                // Check if we have received a response for this drawing
                const hasResponse = this.getDrawingResponseStatus(nestedDrawingName);
                if (!hasResponse) {
                    console.warn(`[MERGE_DWG] No response received for drawing "${nestedDrawingName}" - skipping this insertDwg`);
                    continue;
                }
                
                // Create a processed item for the insertDwg itself and add it to the unindexed items
                const processedInsertDwgItem = {...item}; 
                processedInsertDwgItem.clipRegion = dwgClipRegion;

                // Store the parent transform directly with the item for reliable clipping                
              //  const itemTransform = {...parentTransform};
              //  processedInsertDwgItem.transform = itemTransform;
                
                // Add drawing bounds for clipping - use defaults if data not available
                const nestedDrawingData = this.drawingManagerState.drawingsData[nestedDrawingName];
                let drawingWidth = 50;  // Default width
                let drawingHeight = 50; // Default height
                
                if (nestedDrawingData && nestedDrawingData.data) {
                    drawingWidth = nestedDrawingData.data.x || drawingWidth;
                    drawingHeight = nestedDrawingData.data.y || drawingHeight;
                
                    processedInsertDwgItem.drawingBounds = {
                       width: drawingWidth,
                      height: drawingHeight
                    };
                } else {
                    console.warn(`[MERGE_DWG] insertDwg '${nestedDrawingName}' does not have sizes. Skipping`);
                    continue;
                }
                                
                // Add the nested insertDwg item to the list
                allUnindexedItems.push(processedInsertDwgItem);
                console.log(`[MERGE_DWG] Added nested insertDwg item for "${nestedDrawingName}" to unindexed items list`);
                
                // Process the nested drawing recursively if not already processed
                if (nestedDrawingName && !processedDrawings.has(nestedDrawingName)) {
                    processedDrawings.add(nestedDrawingName);                                                           
                    // Process the nested drawing with the intersection clip region
                    this.mergeDrawingItems(item, allUnindexedItems, allIndexedItemsByNumber, processedDrawings, dwgClipRegion);
                } else if (nestedDrawingName) {
                    console.log(`[MERGE_DWG] Drawing "${nestedDrawingName}" already processed, skipping content processing`);
                }
            } else {
                // Regular drawing item
                const processedItem = {...item};
                processedItem.clipRegion = dwgClipRegion;
                // build combined transform 
                // NOTE: default value only needed for test-modules.html, real display already has transform set
                const itemTransform = {...(processedItem.transform || { x: 0, y: 0, scale: 1 })};
                itemTransform.x = itemTransform.x * dwgTransform.scale + dwgTransform.x;
                itemTransform.y = itemTransform.y * dwgTransform.scale + dwgTransform.y;
                itemTransform.scale = itemTransform.scale *  dwgTransform.scale;
                processedItem.transform = itemTransform;
                console.log(`[MERGE_DWG] Added unindexed Item  ${JSON.stringify(processedItem)}`);
                allUnindexedItems.push(processedItem);
            }
        }
        
        // Process indexed items
        for (const idx in drawingIndexedItems) {
            const item = drawingIndexedItems[idx];

            console.log(`[MERGE_DWG] Processing indexed item idx=${idx}, type='${item.type}' in drawing "${drawingName}"`);
            const processedItem = {...item};
            processedItem.clipRegion = dwgClipRegion;
            const itemTransform = {...processedItem.transform};
            itemTransform.x += itemTransform.x * dwgTransform.scale + dwgTransform.x;
            itemTransform.y += itemTransform.y * dwgTransform.scale + dwgTransform.y;
            itemTransform.scale = itemTransform.scale *  dwgTransform.scale;
            processedItem.transform = itemTransform;
            
           // Add to indexed items collection replacing existing 
           const numericIdx = parseInt(idx);
               // check for overwrite of another dwg
           if (!allIndexedItemsByNumber[numericIdx]) {
                //allIndexedItemsByNumber[numericIdx] = processedItem;
            } else {
               const currentItem = allIndexedItemsByNumber[numericIdx];
               console.log(`[MERGE_DWG] Updating existing item with index ${numericIdx} in "${processedItem.drawingName}" with at ${JSON.stringify(processedItem)}`);
               if (currentItem.parentDrawingName !== processedItem.parentDrawingName) {
                 console.warn(`[MERGE_DWG] Error: Updating existing item with index ${numericIdx} in "${processedItem.parentDrawingName}" with item from different drawing, "${currentItem.parentDrawingName}"`);
               }
               // save current transform
               processedItem.transform = {...currentItem.transform}; // keep new data but change transform and clipRegion
               processedItem.clipRegion = {...currentItem.clipRegion};
               console.log(`[MERGE_DWG_UPDATE] Update existing item with index ${numericIdx} to ${JSON.stringify(processedItem)}`);
            }    
            console.log(`[MERGE_DWG] Added indexed Item  ${JSON.stringify(processedItem)}`);
            allIndexedItemsByNumber[numericIdx] = processedItem;
        }
        
        console.log(`[MERGE_DWG] Completed merging items from "${drawingName}" at ${new Date().toISOString()}`);
        console.log(`[MERGE_DWG] Current status: ${allUnindexedItems.length} unindexed items, ${Object.keys(allIndexedItemsByNumber).length} different indices, ${Object.keys(this.drawingManagerState.allTouchZonesByCmd).length} touchZones `);
    }

    // Get current state for debugging
    getState() {
        return {
            canvasSize: { width: this.canvas?.width, height: this.canvas?.height },
            hasCompletedFirstDraw: this.hasCompletedFirstDraw,
            currentDrawingName: this.getCurrentDrawingName()
        };
    }
}

// Export as global for browser compatibility
window.MergeAndRedraw = MergeAndRedraw;