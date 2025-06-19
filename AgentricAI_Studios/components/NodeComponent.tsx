


import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { NodeData, Port, NodeComponentProps } from '../src/core/types';
import { NodeType } from '../src/core/types';
import { DATA_TYPE_COLORS, ANY_TYPE_PORT_COLOR, MIN_NODE_HEIGHT } from '../src/core/constants';


const PortPill: React.FC<{ port: Port; type: 'input' | 'output'; nodeId: string, isDisabled: boolean }> = ({ port, type, nodeId, isDisabled }) => {
  const isInput = type === 'input';
  const isSketchpadPort = nodeId.toLowerCase().includes('sketchpad') && (port.id === 'base_image_in' || port.id === 'sketch_image_out');
  const portColorClass = (port.dataType === 'any' || isSketchpadPort) ? ANY_TYPE_PORT_COLOR : DATA_TYPE_COLORS[port.dataType] || 'bg-gray-400';

  return (
    <div
      className={`port-handle flex items-center my-1 px-2 py-0.5 rounded text-xs transition-colors
                  ${isInput ? 'justify-start -ml-1' : 'justify-end -mr-1'}
                  ${isDisabled ? 'bg-neutral-700 opacity-50 cursor-not-allowed' : 'bg-neutral-800 hover:bg-neutral-700 hover:bg-opacity-70 text-gray-300'}`}
      title={`${port.name} (${port.dataType})${isDisabled ? ' (Disabled)' : ''}`}
      data-node-id={nodeId}
      data-port-id={port.id}
      data-port-type={type}
      style={isDisabled ? { pointerEvents: 'none' } : {}}
    >
      <div className={`w-2.5 h-2.5 rounded-full border border-gray-400 shadow-sm
                      ${isInput ? 'mr-1.5' : 'ml-1.5 order-last'}
                      ${portColorClass}`}></div>
      <span className={`truncate max-w-[70px] ${isDisabled ? 'text-gray-500' : 'text-gray-300'}`}>{port.name}</span>
    </div>
  );
};

const NodeStatusIndicator: React.FC<{ status: NodeData['status'] }> = ({ status }) => {
    let bgColor = 'bg-neutral-500';
    let pulse = false;
    switch (status) {
        case 'running': bgColor = 'bg-sky-500'; pulse = true; break;
        case 'success': bgColor = 'bg-green-500'; break;
        case 'error': bgColor = 'bg-red-500'; break;
        default: bgColor = 'bg-neutral-500';
    }
    return <div className={`w-3 h-3 rounded-full ${bgColor} ${pulse ? 'animate-pulse' : ''}`} title={`Status: ${status}`}></div>;
};


function NodeComponent({
    node,
    executeNode,
    updateNodeInternalState,
    onCloseNode,
    isHighlighted,
    activeDrawingToolNodeId,
    setActiveDrawingToolNodeId,
}: NodeComponentProps): JSX.Element {
  const nodeBaseBg = 'bg-black';
  const nodeHeaderBg = 'bg-neutral-900';

  const isEffectivelyDisabled = useMemo(() => activeDrawingToolNodeId !== null && activeDrawingToolNodeId !== node.id, [activeDrawingToolNodeId, node.id]);

  const rivetBorder = isHighlighted && !isEffectivelyDisabled
    ? 'border-4 border-dotted border-sky-400'
    : 'border-4 border-dotted border-neutral-800';
  
  const computedBoxShadowColor = useMemo(() => {
    if (isEffectivelyDisabled) return 'rgba(0, 0, 0, 0.3)';
    if (isHighlighted && node.status === 'running') return 'rgba(56, 189, 248, 0.75)'; // sky-400
    if (isHighlighted) return 'rgba(56, 189, 248, 0.6)'; // sky-400
    if (node.status === 'running') return 'rgba(56, 189, 248, 0.5)'; // sky-500
    if (node.status === 'success') return 'rgba(34, 197, 94, 0.5)';  // green-500
    if (node.status === 'error') return 'rgba(239, 68, 68, 0.5)';    // red-500
    return 'rgba(0, 0, 0, 0.5)'; // default (neutral/blackish)
  }, [isHighlighted, node.status, isEffectivelyDisabled]);


  // Sketchpad specific state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMouseOnCanvas, setIsMouseOnCanvas] = useState(false); // For cursor style
  const [isDrawingOnThisCanvas, setIsDrawingOnThisCanvas] = useState(false); // True when mouse is down on *this* canvas AND this node holds the lock
  const [isThisNodeDrawModeOn, setIsThisNodeDrawModeOn] = useState<boolean>(false); // This sketchpad's toggle button state
  const [canvasBgColor, setCanvasBgColor] = useState<'white' | 'black'>('white');
  const [brushColor, setBrushColor] = useState<'black' | 'white'>('black');
  const [lastPos, setLastPos] = useState<{ x: number, y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleInputChange = (key: string, value: any) => {
    updateNodeInternalState(node.id, { [key]: value }, node.status, node.error, node.executionTime);
  };

  const updateSketchOutput = useCallback(() => {
    if (node.type === NodeType.Sketchpad && canvasRef.current) {
      const outputPortId = node.outputs.find(p => p.id === 'sketch_image_out')?.id;
      if (outputPortId) {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        updateNodeInternalState(node.id, { [outputPortId]: dataUrl }, 'success');
      }
    }
  }, [node.id, node.type, node.outputs, updateNodeInternalState]);


  useEffect(() => {
    if (node.type === NodeType.Sketchpad && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = canvasBgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [node.type, canvasBgColor, node.currentWidth, node.currentHeight]);

  useEffect(() => {
    if (node.type === NodeType.Sketchpad) {
      updateSketchOutput();
    }
  }, [canvasBgColor, node.type, updateSketchOutput]);

  // If this node loses the global drawing lock, ensure its internal drawing state is reset
  useEffect(() => {
    if (node.type === NodeType.Sketchpad && activeDrawingToolNodeId !== node.id && isDrawingOnThisCanvas) {
      setIsDrawingOnThisCanvas(false);
      setLastPos(null);
    }
  }, [activeDrawingToolNodeId, node.id, node.type, isDrawingOnThisCanvas]);

  // Sketchpad drawing handlers
  const startSketchpadDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (node.type !== NodeType.Sketchpad || !canvasRef.current || activeDrawingToolNodeId !== node.id || !isThisNodeDrawModeOn || e.button !== 0) {
      if (node.type === NodeType.Sketchpad && activeDrawingToolNodeId === node.id) e.preventDefault(); // Still prevent context menu
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawingOnThisCanvas(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setLastPos({ x, y });

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawOnSketchpad = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (node.type !== NodeType.Sketchpad || !isDrawingOnThisCanvas || !canvasRef.current || !lastPos || activeDrawingToolNodeId !== node.id) return;
    e.preventDefault(); // Important to prevent canvas drag if mouse leaves/re-enters quickly
    e.stopPropagation();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    ctx.lineTo(currentX, currentY);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    setLastPos({ x: currentX, y: currentY });
  };

  const endSketchpadDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (node.type !== NodeType.Sketchpad || activeDrawingToolNodeId !== node.id) return;
     e.stopPropagation();

    if (isDrawingOnThisCanvas) {
        setIsDrawingOnThisCanvas(false);
        setLastPos(null);
        updateSketchOutput();
    }
  };
  
  const handleSketchpadCanvasMouseLeave = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (node.type === NodeType.Sketchpad && isDrawingOnThisCanvas && activeDrawingToolNodeId === node.id) {
        // If mouse leaves while drawing, treat it as finishing the stroke
        endSketchpadDrawing(e);
    }
    setIsMouseOnCanvas(false);
  };


  const handleSketchpadContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (node.type === NodeType.Sketchpad) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  
  const toggleThisNodeDrawMode = () => {
    if (node.type !== NodeType.Sketchpad || isEffectivelyDisabled) return;
    const newDrawModeState = !isThisNodeDrawModeOn;
    setIsThisNodeDrawModeOn(newDrawModeState);
    setActiveDrawingToolNodeId(newDrawModeState ? node.id : null);
    if (!newDrawModeState && isDrawingOnThisCanvas) { // If turning off while drawing
        setIsDrawingOnThisCanvas(false);
        setLastPos(null);
    }
  };

  const toggleSketchpadBackground = () => {
    if (node.type !== NodeType.Sketchpad || isEffectivelyDisabled || (activeDrawingToolNodeId && activeDrawingToolNodeId !== node.id)) return;
    const newBg = canvasBgColor === 'white' ? 'black' : 'white';
    const newBrush = newBg === 'white' ? 'black' : 'white';
    setCanvasBgColor(newBg);
    setBrushColor(newBrush);
    // Clearing and re-filling canvas after bg change
    if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if(ctx) {
            ctx.fillStyle = newBg;
            ctx.fillRect(0,0,canvas.width, canvas.height);
            updateSketchOutput(); // Update output after clearing with new bg
        }
    }
  };

  const clearSketch = () => {
    if (node.type !== NodeType.Sketchpad || isEffectivelyDisabled || (activeDrawingToolNodeId && activeDrawingToolNodeId !== node.id)) return;
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    updateSketchOutput();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isEffectivelyDisabled) return;
    const file = event.target.files?.[0];
    if (file && node.outputs[0]?.id) {
        updateNodeInternalState(node.id, { [node.outputs[0].id]: file.name }, 'success');
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };


  const renderNodeContent = () => {
    const inputPortForDisplay = node.inputs[0]?.id;
    const outputPortForDisplay = node.outputs[0]?.id;
    const internalElementClasses = "nodrag nowheel w-full p-1 bg-neutral-900 border border-neutral-700 rounded text-xs resize-none text-gray-200 focus:ring-sky-500 focus:border-sky-500";
    const buttonBaseClasses = "px-2 py-1 rounded text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed";

    const isDisabledByDrawLock = isEffectivelyDisabled;

    switch (node.type) {
      case NodeType.TextInput:
        return (
          <textarea
            className={`${internalElementClasses} h-full`}
            value={node.data[outputPortForDisplay] || ''}
            onChange={(e) => handleInputChange(outputPortForDisplay, e.target.value)}
            placeholder="Enter text here..."
            style={{minHeight: '40px'}}
            disabled={isDisabledByDrawLock}
            readOnly={isDisabledByDrawLock}
          />
        );
      case NodeType.GeminiPrompt:
      case NodeType.LocalLLMPrompt:
        const isLocalLLM = node.type === NodeType.LocalLLMPrompt;
        const buttonColor = isLocalLLM ? "bg-orange-600 hover:bg-orange-700" : "bg-purple-600 hover:bg-purple-700";
        const isPromptEmpty = !(node.data.prompt_in || node.data.ui_prompt_value?.trim());
        return (
          <div className="flex flex-col space-y-1 w-full h-full">
            <textarea
              className={`${internalElementClasses} flex-grow`}
              value={node.data.ui_prompt_value || ''}
              onChange={(e) => handleInputChange('ui_prompt_value', e.target.value)}
              placeholder="Enter prompt or connect input..."
              style={{minHeight: '30px'}}
              disabled={isDisabledByDrawLock}
              readOnly={isDisabledByDrawLock}
            />
            <button
                onClick={() => executeNode(node.id)}
                disabled={node.status === 'running' || isPromptEmpty || isDisabledByDrawLock}
                className={`${buttonBaseClasses} ${buttonColor} w-full`}>
                {node.status === 'running' ? 'Running...' : 'Run Prompt'}
            </button>
            {outputPortForDisplay && node.data[outputPortForDisplay] && (
              <div className={`mt-1 p-1 border border-neutral-700 rounded bg-neutral-900 text-xs max-h-20 overflow-y-auto text-gray-300 w-full ${isDisabledByDrawLock ? 'opacity-50' : ''}`}>
                {String(node.data[outputPortForDisplay]).substring(0, 200)}{String(node.data[outputPortForDisplay]).length > 200 ? '...' : ''}
              </div>
            )}
          </div>
        );
      case NodeType.ImageGenerator:
        const isImagePromptEmpty = !(node.data.prompt_in || node.data.ui_prompt_value?.trim());
        return (
          <div className="flex flex-col space-y-1 w-full h-full">
            <input
              type="text"
              className={`${internalElementClasses} p-1.5`}
              value={node.data.ui_prompt_value || ''}
              onChange={(e) => handleInputChange('ui_prompt_value', e.target.value)}
              placeholder="Enter image prompt..."
              disabled={isDisabledByDrawLock}
              readOnly={isDisabledByDrawLock}
            />
            <button
                onClick={() => executeNode(node.id)}
                disabled={node.status === 'running' || isImagePromptEmpty || isDisabledByDrawLock}
                className={`${buttonBaseClasses} bg-teal-600 hover:bg-teal-700 mt-1 w-full`}>
                {node.status === 'running' ? 'Generating...' : 'Generate Image'}
            </button>
            {outputPortForDisplay && node.data[outputPortForDisplay] && (node.data[outputPortForDisplay] as string).startsWith('data:image') && (
              <img src={node.data[outputPortForDisplay] as string} alt="Generated" className={`mt-1 rounded border border-neutral-700 w-full max-h-32 object-contain ${isDisabledByDrawLock ? 'opacity-50' : ''}`} />
            )}
          </div>
        );
      case NodeType.DisplayData:
        let displayContent = "No data connected or data is empty.";
        if (inputPortForDisplay && node.data[inputPortForDisplay] !== undefined && node.data[inputPortForDisplay] !== null) {
            try {
                displayContent = JSON.stringify(node.data[inputPortForDisplay], null, 2);
            } catch {
                displayContent = String(node.data[inputPortForDisplay]);
            }
        }
        return (
            <pre className={`${internalElementClasses} h-full overflow-auto whitespace-pre-wrap break-all ${isDisabledByDrawLock ? 'opacity-50 text-gray-500' : ''}`}>{displayContent}</pre>
        );
      case NodeType.DisplayText:
        const textValue = (inputPortForDisplay && node.data[inputPortForDisplay] !== undefined) ? String(node.data[inputPortForDisplay]) : "No text connected.";
        return (
            <div className={`${internalElementClasses} h-full overflow-auto whitespace-pre-wrap break-all ${isDisabledByDrawLock ? 'opacity-50 text-gray-500' : ''}`}>{textValue}</div>
        );
      case NodeType.DisplayImage:
        const imageUrl = (inputPortForDisplay && node.data[inputPortForDisplay] && typeof node.data[inputPortForDisplay] === 'string' && (node.data[inputPortForDisplay] as string).startsWith('data:image'))
                            ? node.data[inputPortForDisplay] as string
                            : null;
        return (
            <div className={`flex items-center justify-center w-full h-full ${isDisabledByDrawLock ? 'opacity-50' : ''}`}>
                {imageUrl ? (
                    <img src={imageUrl} alt="Display" className="nodrag nowheel rounded border border-neutral-700 max-w-full max-h-full object-contain"/>
                ) : (
                    <div className="text-xs text-gray-500">No image connected</div>
                )}
            </div>
        );
      case NodeType.Sketchpad:
        const canvasWidth = (node.currentWidth || 220) - 80; 
        const canvasHeight = (node.currentHeight || 220) - 80;
        const isThisSketchpadActiveForDrawing = activeDrawingToolNodeId === node.id;
        const sketchpadCanvasCursor = isThisSketchpadActiveForDrawing && isThisNodeDrawModeOn ? 'crosshair' : 'default';

        return (
          <div className="flex flex-col items-center justify-center w-full h-full space-y-1">
            <canvas
              ref={canvasRef}
              width={Math.max(50, canvasWidth)}
              height={Math.max(50, canvasHeight)}
              className="nodrag nowheel border border-neutral-600 rounded"
              style={{ cursor: isEffectivelyDisabled ? 'not-allowed' : sketchpadCanvasCursor }}
              onMouseDown={startSketchpadDrawing}
              onMouseMove={drawOnSketchpad}
              onMouseUp={endSketchpadDrawing}
              onMouseLeave={handleSketchpadCanvasMouseLeave}
              onContextMenu={handleSketchpadContextMenu}
              onMouseEnter={() => setIsMouseOnCanvas(true)}
            />
            <button 
                onClick={toggleThisNodeDrawMode} 
                disabled={isEffectivelyDisabled}
                className={`${buttonBaseClasses} w-full ${isThisNodeDrawModeOn ? 'bg-sky-600 hover:bg-sky-500' : 'bg-neutral-600 hover:bg-neutral-500'}`}
                title="Toggle drawing mode (Hint: Numpad0)"
            >
                Toggle Draw (0): {isThisNodeDrawModeOn ? 'ON' : 'OFF'}
            </button>
            <div className="flex space-x-1 w-full px-1">
              <button 
                onClick={toggleSketchpadBackground} 
                className={`${buttonBaseClasses} bg-neutral-600 hover:bg-neutral-500 flex-1`} 
                title="Toggle Background/Brush Color"
                disabled={isEffectivelyDisabled}
                >
                BG: {canvasBgColor === 'white' ? 'B' : 'W'}
              </button>
              <button 
                onClick={clearSketch} 
                className={`${buttonBaseClasses} bg-red-600 hover:bg-red-500 flex-1`} 
                title="Clear Sketch"
                disabled={isEffectivelyDisabled}
                >Clear</button>
            </div>
          </div>
        );
      case NodeType.LocalModelFileSelector:
        const selectedFileName = outputPortForDisplay && node.data[outputPortForDisplay] ? String(node.data[outputPortForDisplay]) : "None";
        return (
            <div className="flex flex-col items-center justify-center w-full h-full space-y-2 p-1">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="nodrag nowheel hidden"
                    accept=".safetensors, .bin, .gguf"
                    disabled={isDisabledByDrawLock}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`${buttonBaseClasses} bg-sky-600 hover:bg-sky-700 w-full`}
                    disabled={isDisabledByDrawLock}
                >
                    Select Model File
                </button>
                <p className={`text-xs text-gray-400 text-center truncate w-full ${isDisabledByDrawLock ? 'opacity-50' : ''}`} title={selectedFileName}>
                    Selected: {selectedFileName}
                </p>
            </div>
        );
      case NodeType.MultiPromptNode:
        return (
          <div className="flex flex-col items-center justify-center w-full h-full">
            <button
                onClick={() => executeNode(node.id)}
                disabled={node.status === 'running' || isDisabledByDrawLock}
                className={`${buttonBaseClasses} ${node.color || 'bg-slate-600'} hover:opacity-80 w-full`}
                title="Assemble prompt parts into a single text output"
            >
                {node.status === 'running' ? 'Assembling...' : 'Assemble Prompt'}
            </button>
            {outputPortForDisplay && node.data[outputPortForDisplay] && (
              <div className={`mt-1 p-1 border border-neutral-700 rounded bg-neutral-900 text-xs max-h-20 overflow-y-auto text-gray-300 w-full ${isDisabledByDrawLock ? 'opacity-50' : ''}`}>
                {String(node.data[outputPortForDisplay]).substring(0, 200)}{String(node.data[outputPortForDisplay]).length > 200 ? '...' : ''}
              </div>
            )}
          </div>
        );
      default:
        if (node.isDynamic) {
            const allRequiredInputsPresent = node.inputs.every(inputPort =>
                inputPort.exampleValue !== undefined ||
                (node.data[inputPort.id] !== undefined && node.data[inputPort.id] !== null && String(node.data[inputPort.id]).trim() !== '')
            );
            const isDynamicNodeDisabled = node.status === 'running' || (node.inputs.length > 0 && !allRequiredInputsPresent) || isDisabledByDrawLock;

            return (
                <button
                    onClick={() => executeNode(node.id)}
                    disabled={isDynamicNodeDisabled}
                    className={`${buttonBaseClasses} ${node.color || 'bg-sky-600'} hover:opacity-80 mt-1 w-full`}
                    title={isDynamicNodeDisabled && ! (node.status === 'running') ? "Connect all required inputs or drawing lock active" : "Run Node"}>
                    {node.status === 'running' ? 'Running...' : (node.name.startsWith("The ") ? `Activate ${node.name}`: `Run ${node.name}`)}
                </button>
            );
        }
        return <div className={`text-xs text-gray-500 p-1 ${isDisabledByDrawLock ? 'opacity-50' : ''}`}>Node content area.</div>;
    }
  };

  const nodeStyle: React.CSSProperties = {
    left: node.x,
    top: node.y,
    width: `${node.currentWidth || 220}px`,
    height: `${node.currentHeight || 
        (node.type === NodeType.ImageGenerator ? 150 : 
        (node.type === NodeType.Sketchpad ? 220 : 
        (node.type === NodeType.LocalModelFileSelector ? 110 : 
        (node.type === NodeType.LocalLLMPrompt || node.type === NodeType.GeminiPrompt ? 130 : 
        (node.type === NodeType.MultiPromptNode ? 180 : MIN_NODE_HEIGHT)))))}px`,
    minWidth: '180px',
    minHeight: node.type === NodeType.ImageGenerator ? '120px' : 
                 node.type === NodeType.Sketchpad ? '180px' : 
                 node.type === NodeType.LocalModelFileSelector ? '100px' : 
                 (node.type === NodeType.LocalLLMPrompt || node.type === NodeType.GeminiPrompt ? 100 : 
                 (node.type === NodeType.MultiPromptNode ? 150 : MIN_NODE_HEIGHT)), // Adjusted min height for MultiPromptNode
    display: 'flex',
    flexDirection: 'column',
    boxShadow: `0 0 10px ${computedBoxShadowColor}, 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)`,
    opacity: isEffectivelyDisabled ? 0.6 : 1,
    transition: 'opacity 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
  };
  
  const contentPointerEvents = isEffectivelyDisabled ? 'none' : 'auto';

  return (
    <div
      id={node.id}
      className={`draggable-node absolute shadow-lg rounded-md ${nodeBaseBg} ${rivetBorder} transition-all duration-150 group`}
      style={nodeStyle}
    >
      <div className={`node-header p-1.5 h-9 flex items-center rounded-t-sm ${nodeHeaderBg} ${activeDrawingToolNodeId ? 'cursor-default' : 'cursor-grab'}`}>
        <span className="text-md mr-1.5 text-gray-200" style={{minWidth: '20px', textAlign: 'center'}}>{node.icon || '⚙️'}</span>
        <span className="font-semibold text-sm truncate text-gray-200 flex-grow mr-1">{node.name}</span>
        <NodeStatusIndicator status={node.status} />
        <button
          onClick={(e) => {
            if (activeDrawingToolNodeId) return; // Prevent close if drawing lock active
            e.stopPropagation();
            onCloseNode(node.id);
          }}
          className={`ml-1.5 p-0.5 text-gray-400 hover:text-red-500 focus:outline-none rounded-full hover:bg-neutral-700 ${activeDrawingToolNodeId ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Close node"
          title="Close node"
          disabled={!!activeDrawingToolNodeId}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-grow flex p-1.5 min-h-0 overflow-hidden" style={{pointerEvents: contentPointerEvents}}>
        <div className="w-[60px] flex-shrink-0 pr-1 flex flex-col items-start justify-center space-y-0.5">
          {node.inputs.map(port => (
            <PortPill key={port.id} port={port} type="input" nodeId={node.id} isDisabled={isEffectivelyDisabled} />
          ))}
        </div>

        <div className="flex-grow min-w-0 flex flex-col justify-center items-center p-0.5">
          {renderNodeContent()}
        </div>

        <div className="w-[60px] flex-shrink-0 pl-1 flex flex-col items-end justify-center space-y-0.5">
          {node.outputs.map(port => (
            <PortPill key={port.id} port={port} type="output" nodeId={node.id} isDisabled={isEffectivelyDisabled}/>
          ))}
        </div>
      </div>
      {node.error && (
        <div className="p-1.5 bg-red-700 bg-opacity-80 text-white text-xs rounded-b-sm border-t border-red-500 max-h-20 overflow-y-auto whitespace-pre-wrap break-all" style={{pointerEvents: contentPointerEvents}}>
          <strong>Error:</strong> {node.error}
          {node.executionTime && <span className="text-xs text-gray-300 block">Time: {node.executionTime}</span>}
        </div>
      )}
       {!node.error && node.executionTime && node.executionTime !== 'N/A' && (
         <div className="p-1 text-xs text-gray-400 bg-neutral-800 bg-opacity-80 rounded-b-sm text-center" style={{pointerEvents: contentPointerEvents}}>
           Time: {node.executionTime}
         </div>
       )}
      <div
        className={`absolute bottom-0 right-0 w-3 h-3 bg-neutral-700 opacity-0 group-hover:opacity-100 ${activeDrawingToolNodeId ? 'cursor-not-allowed' : 'cursor-se-resize'} transition-opacity`}
        data-resize-handle="true"
        data-node-id={node.id}
        title="Resize Node"
        style={activeDrawingToolNodeId ? { pointerEvents: 'none'} : {}}
      ></div>
    </div>
  );
}

export default React.memo(NodeComponent);