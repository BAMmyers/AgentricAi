

import React, { useState, useCallback, useEffect, ForwardedRef } from 'react';
import type { NodeData, Edge, Point, DynamicNodeConfig, Port } from '../src/core/types';
// Renamed CanvasComponentProps from App to avoid conflict with local definition
import type { CanvasComponentProps as AppCanvasComponentInternalProps } from '../src/core/types';
import NodeComponent from './NodeComponent'; // Ensured path is correct
import { MIN_ZOOM, MAX_ZOOM, ZOOM_SENSITIVITY, DATA_TYPE_STROKE_COLORS, DEFAULT_EDGE_COLOR, MIN_NODE_HEIGHT, MIN_NODE_WIDTH, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '../src/core/constants';

// Use the props from types.ts, and add onViewTransformChange
interface CanvasComponentProps extends AppCanvasComponentInternalProps {
  onViewTransformChange: (transform: { x: number, y: number, k: number }) => void;
  highlightedNodeId?: string | null;
  activeDrawingToolNodeId: string | null; // ID of the node that has drawing lock
  setActiveDrawingToolNodeId: (nodeId: string | null) => void; // Setter for the lock
}


interface DraggingStateBase {
  initialMouseX: number; // Viewport coords
  initialMouseY: number; // Viewport coords
}
interface NodeDraggingState extends DraggingStateBase {
  type: 'node';
  nodeId: string;
  initialNodeX: number; // World coords
  initialNodeY: number; // World coords
}
interface PanningState extends DraggingStateBase {
  type: 'pan';
  initialViewX: number; // World coords
  initialViewY: number; // World coords
}
interface ResizingState extends DraggingStateBase {
    type: 'resizing_node';
    nodeId: string;
    initialNodeX: number;
    initialNodeY: number;
    initialNodeWidth: number;
    initialNodeHeight: number;
}
type DraggingState = NodeDraggingState | PanningState | ResizingState;


interface ConnectingState {
  sourceNodeId: string;
  sourceOutputId: string;
  startPoint: Point; // Viewport coordinates
  currentEndPoint: Point; // Viewport coordinates
  sourceDataType: Port['dataType'];
}

const GridBackground: React.FC<{ viewTransform: { x: number, y: number, k: number } }> = React.memo(({ viewTransform }) => {
  const { x, y, k } = viewTransform;
  const gridSize = 50 * k;
  const smallGridSize = 10 * k;

  const smallGridColor = "#262626"; // neutral-800
  const largeGridColor = "#404040"; // neutral-700

  const strongStroke = Math.max(0.3, 1 * Math.sqrt(k))/k;
  const weakStroke = Math.max(0.1, 0.5 * Math.sqrt(k))/k;

  return (
    <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none">
      <defs>
        <pattern id="smallGridCanvas" width={smallGridSize} height={smallGridSize} patternUnits="userSpaceOnUse" patternTransform={`translate(${x % smallGridSize} ${y % smallGridSize})`}>
          <path d={`M ${smallGridSize} 0 L 0 0 0 ${smallGridSize}`} fill="none" stroke={smallGridColor} strokeWidth={weakStroke} />
        </pattern>
        <pattern id="gridCanvas" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse" patternTransform={`translate(${x % gridSize} ${y % gridSize})`}>
          <rect width={gridSize} height={gridSize} fill="url(#smallGridCanvas)" />
          <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke={largeGridColor} strokeWidth={strongStroke} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#gridCanvas)" />
    </svg>
  );
});


const CanvasComponent = React.forwardRef<HTMLDivElement, CanvasComponentProps>(
  (props, ref: ForwardedRef<HTMLDivElement>) => {
  const {
    nodes,
    edges,
    onNodeDrag,
    setNodes,
    setEdges,
    executeNode,
    updateNodeInternalState,
    onRemoveNode,
    onViewTransformChange,
    highlightedNodeId,
    activeDrawingToolNodeId,
    setActiveDrawingToolNodeId,
  } = props;

  const [viewTransform, setViewTransformState] = useState({ x: 150, y: 100, k: 1 });
  const [draggingState, setDraggingState] = useState<DraggingState | null>(null);
  const [connectingState, setConnectingState] = useState<ConnectingState | null>(null);

  useEffect(() => {
    onViewTransformChange(viewTransform);
  }, [viewTransform, onViewTransformChange]);

  const setViewTransform = useCallback((newTransformOrCallback: React.SetStateAction<{ x: number; y: number; k: number; }>) => {
    setViewTransformState(prevTransform => {
        const newTransform = typeof newTransformOrCallback === 'function'
            ? newTransformOrCallback(prevTransform)
            : newTransformOrCallback;
        return newTransform;
    });
  }, []);


  const worldToViewport = useCallback((worldX: number, worldY: number): Point => {
    return {
      x: worldX * viewTransform.k + viewTransform.x,
      y: worldY * viewTransform.k + viewTransform.y,
    };
  }, [viewTransform]);

  const viewportToWorld = useCallback((viewportX: number, viewportY: number): Point => {
    const currentCanvas = (ref as React.RefObject<HTMLDivElement>)?.current;
    if (!currentCanvas) return { x: 0, y: 0 };
    const rect = currentCanvas.getBoundingClientRect();
    return {
      x: (viewportX - rect.left - viewTransform.x) / viewTransform.k,
      y: (viewportY - rect.top - viewTransform.y) / viewTransform.k,
    };
  }, [viewTransform, ref]);

  const getPortInfo = useCallback((nodeId: string, portId: string, portType: 'input' | 'output'): { point: Point, dataType: Port['dataType'] } | null => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.currentWidth || !node.currentHeight) return null;

    const portArray = portType === 'input' ? node.inputs : node.outputs;
    const portIndex = portArray.findIndex(p => p.id === portId);
    const port = portArray[portIndex];
    if (portIndex === -1 || !port) return null;

    const portSpacing = 25;
    const headerHeight = 36;
    const nodePaddingY = 6;

    const portPillHeight = 20;
    const totalPortsHeight = portArray.length * portPillHeight + (portArray.length > 0 ? (portArray.length -1) * 4 : 0);
    const contentAreaHeight = node.currentHeight - headerHeight - (nodePaddingY * 2) - (node.error ? 30 : 0) - (node.executionTime && node.executionTime !=='N/A' && !node.error ? 20 : 0) ;

    let portRelativeY = headerHeight + nodePaddingY + (portIndex * portSpacing) + (portSpacing / 2);

    if (contentAreaHeight > totalPortsHeight) {
        const offsetY = (contentAreaHeight - totalPortsHeight) / 2;
        portRelativeY = headerHeight + nodePaddingY + offsetY + (portIndex * (portPillHeight + 4)) + (portPillHeight/2) ;
    } else {
         portRelativeY = headerHeight + nodePaddingY + (portIndex * portSpacing) + (portSpacing / 2);
    }

    const portRelativeX = portType === 'input' ? 0 : node.currentWidth;
    const portWorldX = node.x + portRelativeX;
    const portWorldY = node.y + portRelativeY;

    return { point: worldToViewport(portWorldX, portWorldY), dataType: port.dataType };
  }, [nodes, worldToViewport]);


  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const currentCanvas = (ref as React.RefObject<HTMLDivElement>)?.current;
    if (!currentCanvas) return;
    const target = e.target as HTMLElement;

    // If drawing lock is active, many interactions are disabled.
    // Sketchpad itself handles its internal drawing if it's the activeDrawingToolNodeId.
    // CanvasComponent should prevent its general interactions.

    const isNodeElement = target.closest('.draggable-node');
    const isNodeHeader = target.closest('.node-header');
    const isPortElement = target.closest('.port-handle');
    const isResizeHandle = target.dataset.resizeHandle === 'true';

    // Allow interaction if it's on the active drawing sketchpad's specific drawing canvas or its direct controls
    // This check is more nuanced and primarily handled within NodeComponent for its own canvas.
    // Here, we mostly care about disabling general canvas interactions.
    if (activeDrawingToolNodeId) {
        // If target is part of the active drawing node, NodeComponent will handle it.
        // Prevent all other canvas-level interactions (pan, other node drag/resize, port connection).
        if (!isNodeElement || (isNodeElement && isNodeElement.id !== activeDrawingToolNodeId)) {
             // If the click is on the canvas background OR on a different node, disable.
             // This effectively prevents panning and interacting with other nodes.
             e.stopPropagation();
             e.preventDefault();
             setDraggingState(null); // Ensure no dragging state is set
             setConnectingState(null); // Ensure no connecting state
             return;
        }
        // If it IS the active drawing node, we still don't want to drag/resize it from here.
        // Its internal drawing canvas takes precedence.
        if (isNodeHeader || isResizeHandle || isPortElement) {
             e.stopPropagation();
             e.preventDefault();
             setDraggingState(null);
             setConnectingState(null);
             return;
        }
    }


    const closeButton = target.closest('button[aria-label="Close node"]');
    if (closeButton && activeDrawingToolNodeId) { // Prevent closing nodes if drawing lock is active
        e.stopPropagation();
        return;
    }
    if (closeButton) return; // Allow close if no lock

    const nodeElement = target.closest('.draggable-node');
    const portElement = target.closest('.port-handle') as HTMLElement | null;
    const resizeHandle = target.dataset.resizeHandle === 'true' ? target : null;

    if (resizeHandle && nodeElement && !activeDrawingToolNodeId) {
        e.stopPropagation();
        const nodeId = resizeHandle.dataset.nodeId;
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            setDraggingState({
                type: 'resizing_node',
                nodeId: nodeId!,
                initialMouseX: e.clientX,
                initialMouseY: e.clientY,
                initialNodeX: node.x,
                initialNodeY: node.y,
                initialNodeWidth: node.currentWidth || DEFAULT_NODE_WIDTH,
                initialNodeHeight: node.currentHeight || DEFAULT_NODE_HEIGHT,
            });
        }
    } else if (portElement && !activeDrawingToolNodeId) {
        e.stopPropagation();
        const nodeId = portElement.dataset.nodeId;
        const portId = portElement.dataset.portId;
        const portType = portElement.dataset.portType as ('input' | 'output');

        if (nodeId && portId && portType === 'output') {
            const portInfo = getPortInfo(nodeId, portId, 'output');
            if (portInfo && currentCanvas) {
                const canvasRect = currentCanvas.getBoundingClientRect();
                setConnectingState({
                    sourceNodeId: nodeId,
                    sourceOutputId: portId,
                    startPoint: portInfo.point,
                    currentEndPoint: { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top },
                    sourceDataType: portInfo.dataType,
                });
            }
        }
    } else if (nodeElement && (target.classList.contains('node-header') || target.closest('.node-header')) && !activeDrawingToolNodeId) {
      e.stopPropagation();
      const nodeId = nodeElement.id;
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        const worldMouse = viewportToWorld(e.clientX, e.clientY);
        setDraggingState({
          type: 'node',
          nodeId: nodeId,
          initialMouseX: worldMouse.x,
          initialMouseY: worldMouse.y,
          initialNodeX: node.x,
          initialNodeY: node.y,
        });
        currentCanvas.classList.add('grabbing');
      }
    } else if (e.button === 0 && !target.closest('button, input, textarea, select, .port-handle, [data-resize-handle="true"], .draggable-node') && !activeDrawingToolNodeId) {
      // Pan only if not clicking on any interactive element and no drawing lock
      setDraggingState({
        type: 'pan',
        initialMouseX: e.clientX,
        initialMouseY: e.clientY,
        initialViewX: viewTransform.x,
        initialViewY: viewTransform.y,
      });
      currentCanvas.classList.add('grabbing');
    } else if (activeDrawingToolNodeId && e.button === 0 && !target.closest('.draggable-node')) {
        // If drawing lock is active and click is on background, specifically do nothing here.
        // Actual drawing is handled inside NodeComponent.
        e.preventDefault(); // Prevent text selection etc.
    }

  }, [nodes, viewportToWorld, viewTransform, getPortInfo, setViewTransform, ref, activeDrawingToolNodeId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // If drawing lock is active, general canvas move interactions are disabled.
    // Specific drawing interaction is handled by the active Sketchpad NodeComponent.
    if (activeDrawingToolNodeId && draggingState?.type !== 'node') { // Allow node dragging if it was somehow initiated (should be blocked by mousedown)
        if (draggingState?.type === 'pan' || draggingState?.type === 'resizing_node') {
            return; // Explicitly block pan/resize during drawing lock
        }
    }
    
    if (!draggingState && !connectingState) return;
    const currentCanvas = (ref as React.RefObject<HTMLDivElement>)?.current;

    if (connectingState && currentCanvas && !activeDrawingToolNodeId) { // Only allow connections if no drawing lock
        const canvasRect = currentCanvas.getBoundingClientRect();
        setConnectingState(prev => prev ? { ...prev, currentEndPoint: {x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top }} : null);

    } else if (draggingState && !activeDrawingToolNodeId) { // Only allow dragging/panning if no drawing lock
        if (draggingState.type === 'node') {
            const worldMouse = viewportToWorld(e.clientX, e.clientY);
            const dx = worldMouse.x - draggingState.initialMouseX;
            const dy = worldMouse.y - draggingState.initialMouseY;
            onNodeDrag(draggingState.nodeId, draggingState.initialNodeX + dx, draggingState.initialNodeY + dy);
        } else if (draggingState.type === 'pan') {
            const dx = e.clientX - draggingState.initialMouseX;
            const dy = e.clientY - draggingState.initialMouseY;
            setViewTransform(prev => ({ ...prev, x: draggingState.initialViewX + dx, y: draggingState.initialViewY + dy }));
        } else if (draggingState.type === 'resizing_node') {
            const deltaX = e.clientX - draggingState.initialMouseX;
            const deltaY = e.clientY - draggingState.initialMouseY;
            const newWidth = Math.max(MIN_NODE_WIDTH, draggingState.initialNodeWidth + deltaX / viewTransform.k);
            const newHeight = Math.max(MIN_NODE_HEIGHT, draggingState.initialNodeHeight + deltaY / viewTransform.k);
            setNodes(prev => prev.map(n => n.id === draggingState.nodeId ? { ...n, currentWidth: newWidth, currentHeight: newHeight } : n));
        }
    }
  }, [draggingState, connectingState, viewportToWorld, onNodeDrag, setNodes, viewTransform.k, setViewTransform, ref, activeDrawingToolNodeId]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const currentCanvas = (ref as React.RefObject<HTMLDivElement>)?.current;
    if (currentCanvas) {
        currentCanvas.classList.remove('grabbing');
    }

    if (connectingState && !activeDrawingToolNodeId) { // Only complete connections if no drawing lock
        const targetElement = e.target as HTMLElement;
        const portElement = targetElement.closest('.port-handle') as HTMLElement | null;
        if (portElement) {
            const targetNodeId = portElement.dataset.nodeId;
            const targetInputId = portElement.dataset.portId;
            const portType = portElement.dataset.portType as ('input' | 'output');

            if (targetNodeId && targetInputId && portType === 'input') {
                const sourceNode = nodes.find(n => n.id === connectingState.sourceNodeId);
                const targetNode = nodes.find(n => n.id === targetNodeId);
                if (sourceNode && targetNode) {
                    const sourcePort = sourceNode.outputs.find(p => p.id === connectingState.sourceOutputId);
                    const targetPort = targetNode.inputs.find(p => p.id === targetInputId);

                    if (sourcePort && targetPort && (targetPort.dataType === 'any' || targetPort.dataType === sourcePort.dataType || sourcePort.dataType === 'any')) {
                        const newEdge: Edge = {
                            id: `edge-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
                            sourceNodeId: connectingState.sourceNodeId,
                            sourceOutputId: connectingState.sourceOutputId,
                            targetNodeId: targetNodeId,
                            targetInputId: targetInputId,
                        };
                        setEdges(prev => {
                           const filtered = prev.filter(edge => !(edge.targetNodeId === targetNodeId && edge.targetInputId === targetInputId));
                           return [...filtered, newEdge];
                        });
                        if(sourceNode.status === 'success' && sourceNode.data && sourceNode.data[sourcePort.id] !== undefined) {
                            updateNodeInternalState(targetNode.id, { [targetPort.id]: sourceNode.data[sourcePort.id] }, 'idle', null, undefined);
                        }
                    } else {
                        console.warn("Cannot connect: Incompatible port data types or port not found.");
                    }
                }
            }
        }
    }
    setConnectingState(null); // Clear connecting state regardless of lock
    setDraggingState(null); // Clear dragging state regardless of lock
  }, [nodes, setEdges, connectingState, updateNodeInternalState, ref, activeDrawingToolNodeId]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (activeDrawingToolNodeId) { // Disable zoom if drawing lock active
      e.preventDefault();
      return;
    }

    e.preventDefault();
    const currentCanvas = (ref as React.RefObject<HTMLDivElement>)?.current;
    if (!currentCanvas) return;

    const scrollDelta = e.deltaY;
    const zoomFactor = Math.pow(1 - ZOOM_SENSITIVITY, scrollDelta);
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewTransform.k * zoomFactor));

    if (newZoom === viewTransform.k) return;

    const rect = currentCanvas.getBoundingClientRect();
    const mouseXViewport = e.clientX - rect.left;
    const mouseYViewport = e.clientY - rect.top;

    const worldXUnderMouse = (mouseXViewport - viewTransform.x) / viewTransform.k;
    const worldYUnderMouse = (mouseYViewport - viewTransform.y) / viewTransform.k;

    const newViewX = mouseXViewport - worldXUnderMouse * newZoom;
    const newViewY = mouseYViewport - worldYUnderMouse * newZoom;

    setViewTransform({ x: newViewX, y: newViewY, k: newZoom });
  }, [viewTransform.k, viewTransform.x, viewTransform.y, setViewTransform, ref, activeDrawingToolNodeId]);


  const getEdgeColor = (sourceDataType: Port['dataType'], targetDataType: Port['dataType']): string => {
    if (sourceDataType === 'any' && targetDataType === 'any') return DEFAULT_EDGE_COLOR;
    if (sourceDataType === 'any') return DATA_TYPE_STROKE_COLORS[targetDataType] || DEFAULT_EDGE_COLOR;
    if (targetDataType === 'any') return DATA_TYPE_STROKE_COLORS[sourceDataType] || DEFAULT_EDGE_COLOR;
    return DATA_TYPE_STROKE_COLORS[sourceDataType] || DEFAULT_EDGE_COLOR;
  };
  
  const canvasClassName = `w-full h-full relative overflow-hidden bg-neutral-900 ${activeDrawingToolNodeId ? 'cursor-default' : 'grab'}`;

  return (
    <div
      ref={ref}
      className={canvasClassName}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // Changed to handleMouseUp to clear states
      onWheel={handleWheel}
      tabIndex={0}
    >
      <GridBackground viewTransform={viewTransform} />
      <div
        className="absolute top-0 left-0"
        style={{ transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.k})`, transformOrigin: '0 0', willChange: 'transform' }}
      >
        {nodes.map(node => (
          <NodeComponent
            key={node.id}
            node={node}
            executeNode={executeNode}
            updateNodeInternalState={updateNodeInternalState}
            onCloseNode={onRemoveNode}
            isHighlighted={node.id === highlightedNodeId}
            activeDrawingToolNodeId={activeDrawingToolNodeId}
            setActiveDrawingToolNodeId={setActiveDrawingToolNodeId}
          />
        ))}
      </div>
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
        {edges.map(edge => {
            const sourcePortInfo = getPortInfo(edge.sourceNodeId, edge.sourceOutputId, 'output');
            const targetPortInfo = getPortInfo(edge.targetNodeId, edge.targetInputId, 'input');

            if (!sourcePortInfo || !targetPortInfo) return null;

            const startPoint = sourcePortInfo.point;
            const endPoint = targetPortInfo.point;
            const edgeColor = getEdgeColor(sourcePortInfo.dataType, targetPortInfo.dataType);

            const dx = endPoint.x - startPoint.x;
            const dy = endPoint.y - startPoint.y;
            const controlPointX1 = startPoint.x + dx * 0.3;
            const controlPointY1 = startPoint.y + dy * 0.1;
            const controlPointX2 = startPoint.x + dx * 0.7;
            const controlPointY2 = endPoint.y - dy * 0.1;

            const pathData = `M ${startPoint.x} ${startPoint.y} C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2}, ${endPoint.x} ${endPoint.y}`;

            return (
                <path key={edge.id} d={pathData} stroke={edgeColor} strokeWidth="2.5" fill="none" className="transition-all"/>
            );
        })}
        {connectingState && (
            <path
                d={`M ${connectingState.startPoint.x} ${connectingState.startPoint.y} L ${connectingState.currentEndPoint.x} ${connectingState.currentEndPoint.y}`}
                stroke={DATA_TYPE_STROKE_COLORS[connectingState.sourceDataType] || DEFAULT_EDGE_COLOR}
                strokeWidth="2.5"
                fill="none"
                strokeDasharray="5,3"
            />
        )}
      </svg>
    </div>
  );
});
CanvasComponent.displayName = 'CanvasComponent';

export default CanvasComponent;
