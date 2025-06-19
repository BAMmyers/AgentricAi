


import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { initialSystemAgents } from './src/core/agentDefinitions';
import type { NodeData, Edge, DynamicNodeConfig, Port, LlmRuntimeType, LlmServiceConfig, LocalEndpointSettings, CanvasComponentProps, Point } from './src/core/types'; // Removed EmbeddedVoiceProfile
import { NODE_CONFIG, DEFAULT_NODE_WIDTH, MIN_NODE_HEIGHT, DEFAULT_NODE_HEIGHT, MIN_NODE_WIDTH } from './src/core/constants';
import CanvasComponent from './components/CanvasComponent';
import FloatingSearchMenu from './components/FloatingSearchMenu'; // New Component
import { NodeType } from './src/core/types';
import { llmService } from './src/services/llmService';

// Constants for localStorage keys for autosave
const AUTOSAVE_NODES_KEY = 'agenticStudio_autosave_nodes';
const AUTOSAVE_EDGES_KEY = 'agenticStudio_autosave_edges';

// Helper to create ports from definitions
const createPortsFromDefinitions = (portDefs: DynamicNodeConfig['inputs'] | DynamicNodeConfig['outputs'], type: 'input' | 'output'): Port[] => {
  return portDefs.map((def, index) => ({
    id: def.id || `${type}-${def.name.toLowerCase().replace(/\s+/g, '_')}-${index}`,
    name: def.name,
    type: type,
    dataType: def.dataType,
    exampleValue: def.exampleValue
  }));
};

const GEMINI_API_KEY = process.env.API_KEY; // For UI checks

const AgenticStudioApp: React.FC = () => {
  const [nodes, setNodes] = useState<NodeData[]>(() => {
    const savedNodes = localStorage.getItem(AUTOSAVE_NODES_KEY);
    return savedNodes ? JSON.parse(savedNodes) : [];
  });
  const [edges, setEdges] = useState<Edge[]>(() => {
    const savedEdges = localStorage.getItem(AUTOSAVE_EDGES_KEY);
    return savedEdges ? JSON.parse(savedEdges) : [];
  });
  const [availableAgents, setAvailableAgents] = useState<DynamicNodeConfig[]>(() => {
    const staticAgents = Object.entries(NODE_CONFIG).map(([key, config]) => ({
      name: key as NodeType, // The key itself is the NodeType string value
      description: config.description || "A standard node.",
      inputs: createPortsFromDefinitions(config.inputs, 'input'),
      outputs: createPortsFromDefinitions(config.outputs, 'output'),
      color: config.color,
      icon: config.icon,
      isDynamic: false,
      category: config.category,
      requiresWebSearch: config.requiresWebSearch || false,
      currentWidth: DEFAULT_NODE_WIDTH,
      currentHeight: key === NodeType.ImageGenerator ? 150 : 
                     (key === NodeType.Sketchpad ? 220 : 
                     (key === NodeType.LocalModelFileSelector ? 110 : 
                     (key === NodeType.LocalLLMPrompt || key === NodeType.GeminiPrompt ? 130 : 
                     (key === NodeType.MultiPromptNode ? 180 : DEFAULT_NODE_HEIGHT)))), // Adjusted default for MultiPromptNode
    }));

    const dynamicJuggernauts = initialSystemAgents.map(agent => ({
      ...agent,
      inputs: createPortsFromDefinitions(agent.inputs, 'input'),
      outputs: createPortsFromDefinitions(agent.outputs, 'output'),
      isDynamic: true,
      currentWidth: agent.currentWidth || DEFAULT_NODE_WIDTH,
      currentHeight: agent.currentHeight || DEFAULT_NODE_HEIGHT,
    }));

    const allAgents = [...staticAgents, ...dynamicJuggernauts];
    return allAgents.map(agent => ({ ...agent, category: agent.category || "General" }));
  });


  const [llmConfig, setLlmConfig] = useState<LlmServiceConfig>(llmService.getConfiguration());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [dynamicNodeDefinitionPrompt, setDynamicNodeDefinitionPrompt] = useState('');
  const [isDefiningNode, setIsDefiningNode] = useState(false);
  const [nodeDefinitionError, setNodeDefinitionError] = useState<string | null>(null);

  // Floating Search Menu State
  const [showSearchMenu, setShowSearchMenu] = useState(false);
  const [searchMenuViewportPosition, setSearchMenuViewportPosition] = useState<Point>({ x: 0, y: 0 });
  const [lastDoubleClickViewportPosition, setLastDoubleClickViewportPosition] = useState<Point>({ x: 0, y: 0 });
  const [appViewTransform, setAppViewTransform] = useState<{ x: number, y: number, k: number }>({ x: 0, y: 0, k: 1 });
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  // State for Sketchpad drawing lock
  const [activeDrawingToolNodeId, setActiveDrawingToolNodeId] = useState<string | null>(null);


  useEffect(() => {
    localStorage.setItem(AUTOSAVE_NODES_KEY, JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    localStorage.setItem(AUTOSAVE_EDGES_KEY, JSON.stringify(edges));
  }, [edges]);

  useEffect(() => {
    const savedNodes = localStorage.getItem(AUTOSAVE_NODES_KEY);
    const savedEdges = localStorage.getItem(AUTOSAVE_EDGES_KEY);
    if (savedNodes || savedEdges) {
      console.log("AgentricAI Studios: Autosaved workflow from previous session loaded.");
    } else {
      console.log("AgentricAI Studios: No autosaved workflow found, starting fresh canvas.");
    }
  }, []);


  const handleNodeDrag = useCallback((nodeId: string, x: number, y: number) => {
    setNodes(prevNodes => prevNodes.map(n => n.id === nodeId ? { ...n, x, y } : n));
  }, []);

  const addNodeToCanvas = useCallback((agentConfig: DynamicNodeConfig, worldX?: number, worldY?: number) => {
    const newNodeId = `${agentConfig.name.replace(/\s+/g, '_')}-${Date.now()}`;
    const defaultX = 150;
    const defaultY = 100;

    const baseNodeData: NodeData['data'] = {};

    const baseNode: NodeData = {
      id: newNodeId,
      type: agentConfig.name,
      name: agentConfig.name,
      x: worldX ?? defaultX,
      y: worldY ?? defaultY,
      inputs: createPortsFromDefinitions(agentConfig.inputs, 'input'),
      outputs: createPortsFromDefinitions(agentConfig.outputs, 'output'),
      data: baseNodeData,
      isDynamic: agentConfig.isDynamic,
      color: agentConfig.color || 'bg-gray-700',
      icon: agentConfig.icon || '⚙️',
      requiresWebSearch: agentConfig.requiresWebSearch || false,
      category: agentConfig.category || "General",
      status: 'idle',
      currentWidth: agentConfig.currentWidth || DEFAULT_NODE_WIDTH,
      currentHeight: agentConfig.currentHeight || 
                     (agentConfig.name === NodeType.ImageGenerator ? 150 : 
                     (agentConfig.name === NodeType.Sketchpad ? 220 :
                     (agentConfig.name === NodeType.LocalModelFileSelector ? 110 : 
                     (agentConfig.name === NodeType.LocalLLMPrompt || agentConfig.name === NodeType.GeminiPrompt ? 130 : 
                     (agentConfig.name === NodeType.MultiPromptNode ? 180 : DEFAULT_NODE_HEIGHT))))),
    };

    if (agentConfig.isDynamic) {
      baseNode.executionLogicPrompt = agentConfig.executionLogicPrompt;
    }

    agentConfig.inputs.forEach(inputDef => {
        if (inputDef.exampleValue !== undefined && inputDef.id) {
            baseNode.data[inputDef.id] = inputDef.exampleValue;
        }
    });
    if (agentConfig.name === NodeType.TextInput && baseNode.outputs[0]?.id) {
        baseNode.data[baseNode.outputs[0].id] = '';
    }
    if ((agentConfig.name === NodeType.GeminiPrompt || agentConfig.name === NodeType.LocalLLMPrompt) && baseNode.inputs.find(p => p.id === 'prompt_in') && !baseNode.data['prompt_in']){
        baseNode.data['ui_prompt_value'] = ''; // Initialize internal UI prompt
    }
    if (agentConfig.name === NodeType.LocalModelFileSelector && baseNode.outputs[0]?.id) {
        baseNode.data[baseNode.outputs[0].id] = "None";
    }
     if (agentConfig.name === NodeType.MultiPromptNode) {
        agentConfig.inputs.forEach(inputDef => {
            if (inputDef.id) { // Ensure id exists for safety
                 baseNode.data[inputDef.id] = inputDef.exampleValue || "";
            }
        });
    }


    setNodes(prev => [...prev, baseNode]);

    if (agentConfig.name === "The Apprentice") {
        console.log("Apprentice node added. Ready for instructions to build workflows.");
    }

  }, []);

  const onRemoveNode = useCallback((nodeIdToRemove: string) => {
    setNodes(prev => prev.filter(node => node.id !== nodeIdToRemove));
    setEdges(prev => prev.filter(edge => edge.sourceNodeId !== nodeIdToRemove && edge.targetNodeId !== nodeIdToRemove));
    if (highlightedNodeId === nodeIdToRemove) {
      setHighlightedNodeId(null);
    }
    if (activeDrawingToolNodeId === nodeIdToRemove) {
      setActiveDrawingToolNodeId(null); // Release drawing lock if active node is removed
    }
  }, [highlightedNodeId, activeDrawingToolNodeId]);


  const updateNodeInternalState = useCallback((nodeId: string, dataChanges: Partial<NodeData['data']>, status?: NodeData['status'], error?: string | null, executionTime?: string) => {
    setNodes(prevNodes => {
      let nodeChanged = false;
      const newNodes = prevNodes.map(node => {
        if (node.id === nodeId) {
          nodeChanged = true;
          let newData = { ...node.data, ...dataChanges };
          const newStatus = status !== undefined ? status : node.status;
          const newError = error !== undefined ? error : node.error;
          const newExecutionTime = executionTime !== undefined ? executionTime : node.executionTime;
          return { ...node, data: newData, status: newStatus, error: newError, executionTime: newExecutionTime };
        }
        return node;
      });

      if (nodeChanged) {
        const changedNode = newNodes.find(n => n.id === nodeId);
        if (changedNode) {
            if (status === 'success') {
                if (!isWorkflowRunning) {
                  triggerDownstreamExecution(changedNode, newNodes);
                } else {
                  triggerDownstreamExecution(changedNode, newNodes, true);
                }
            }
        }
      }
      return newNodes;
    });
  }, [edges, isWorkflowRunning]);


  const triggerDownstreamExecution = (sourceNode: NodeData, currentNodes: NodeData[], isQueuedRun: boolean = false) => {
      const connectedEdges = edges.filter(edge => edge.sourceNodeId === sourceNode.id);
      for (const edge of connectedEdges) {
          const targetNode = currentNodes.find(n => n.id === edge.targetNodeId);
          const sourcePort = sourceNode.outputs.find(p => p.id === edge.sourceOutputId);
          const targetPort = targetNode?.inputs.find(p => p.id === edge.targetInputId);

          if (targetNode && sourcePort && targetPort && sourceNode.data[sourcePort.id] !== undefined) {
              const newDataForTarget = { [targetPort.id]: sourceNode.data[sourcePort.id] };
              setNodes(prevNodes => prevNodes.map(n => n.id === targetNode.id ? {...n, data: {...n.data, ...newDataForTarget}, status: 'idle', error: null, executionTime: undefined } : n));

              if (!isQueuedRun && (targetNode.isDynamic || targetNode.type === NodeType.GeminiPrompt || targetNode.type === NodeType.LocalLLMPrompt || targetNode.type === NodeType.ImageGenerator || targetNode.type === NodeType.MultiPromptNode)) {
                 setTimeout(() => executeNode(targetNode.id), 50);
              }
          }
      }
  };


  const executeNode = useCallback(async (nodeId: string): Promise<NodeData['status']> => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return 'error';

    // Prevent execution of other nodes if a drawing tool is active
    if (activeDrawingToolNodeId && activeDrawingToolNodeId !== nodeId && node.type !== NodeType.Sketchpad) {
        console.warn(`Execution of node ${nodeId} blocked: Sketchpad drawing tool is active on node ${activeDrawingToolNodeId}.`);
        return 'idle'; // Or 'error'
    }


    setHighlightedNodeId(nodeId);
    updateNodeInternalState(nodeId, {}, 'running', null, '...');
    const startTime = performance.now();
    let finalStatus: NodeData['status'] = 'error';

    try {
      let resultData: Record<string, any> = {};
      let llmError: string | undefined = undefined;

      const currentInputData: Record<string, any> = {};
      node.inputs.forEach(inputPort => {
        currentInputData[inputPort.id] = node.data[inputPort.id];
      });

      if (node.type === NodeType.TextInput) {
        if (node.outputs.length > 0) {
          resultData[node.outputs[0].id] = node.data[node.outputs[0].id] || '';
        }
        finalStatus = 'success';
      } else if (node.type === NodeType.LocalModelFileSelector) {
        if (node.outputs[0]?.id && node.data[node.outputs[0].id]) {
          resultData[node.outputs[0].id] = node.data[node.outputs[0].id];
          finalStatus = 'success';
        } else {
          llmError = "No model file selected or output port missing.";
          finalStatus = 'error';
        }
      } else if (node.type === NodeType.MultiPromptNode) {
          const promptParts: string[] = [];
          const inputPortIds = ['prompt_part_1', 'prompt_part_2', 'prompt_part_3', 'prompt_part_4', 'prompt_part_5'];
          inputPortIds.forEach(portId => {
              const partData = node.data[portId];
              promptParts.push(String(partData || "")); // Convert to string, treat null/undefined as empty string
          });
          const assembledPrompt = promptParts.join(" ").trim(); // Join with space, trim ends
          if (node.outputs.length > 0 && node.outputs[0].id) {
              resultData[node.outputs[0].id] = assembledPrompt;
          }
          finalStatus = 'success';
      } else if (node.type === NodeType.GeminiPrompt || node.type === NodeType.LocalLLMPrompt) {
        const prompt = node.data.prompt_in || node.data.ui_prompt_value || '';
        if (prompt) {
          const webSearchEnabled = node.type === NodeType.GeminiPrompt ? (node.requiresWebSearch || false) : false;
          const { text, error: serviceError } = await llmService.generateText(prompt, webSearchEnabled);
          if (serviceError) llmError = serviceError;
          else if (node.outputs.length > 0) resultData[node.outputs[0].id] = text;
        } else {
          llmError = "Prompt is empty.";
        }
        finalStatus = llmError ? 'error' : 'success';
      } else if (node.type === NodeType.ImageGenerator) {
        const prompt = node.data.prompt_in || node.data.ui_prompt_value || '';
        const localModelNameFromInput = node.data.local_model_identifier_in as string | undefined;
        let imageUrl: string;

        if (prompt) {
          const currentRuntime = llmService.getConfiguration().activeRuntime;
          if ((currentRuntime === 'local_lm_studio' || currentRuntime === 'local_ollama') && localModelNameFromInput && localModelNameFromInput !== "None") {
            imageUrl = await llmService.generateImage(prompt, localModelNameFromInput);
          } else {
            imageUrl = await llmService.generateImage(prompt);
          }

          if (imageUrl.startsWith('Error:')) llmError = imageUrl;
          else if (node.outputs.length > 0) resultData[node.outputs[0].id] = imageUrl;
        } else {
          llmError = "Image prompt is empty.";
        }
        finalStatus = llmError ? 'error' : 'success';
      } else if (node.type === "Universal Data Adapter" && node.isDynamic && node.executionLogicPrompt) {
          const inputPortId = node.inputs[0]?.id;
          const inputData = node.data[inputPortId];
          let inputDataStringified = typeof inputData === 'string' ? inputData : JSON.stringify(inputData);

          const connectedEdge = edges.find(e => e.sourceNodeId === nodeId && e.sourceOutputId === node.outputs[0]?.id);
          let targetDataType = 'any', targetPortName = 'unknown', targetNodeName = 'unknown', targetNodeType = 'unknown';

          if (connectedEdge) {
              const targetNodeInstance = nodes.find(n => n.id === connectedEdge.targetNodeId);
              const targetPortInstance = targetNodeInstance?.inputs.find(p => p.id === connectedEdge.targetInputId);
              if (targetPortInstance && targetNodeInstance) {
                  targetDataType = targetPortInstance.dataType; targetPortName = targetPortInstance.name;
                  targetNodeName = targetNodeInstance.name; targetNodeType = targetNodeInstance.type;
              }
          }

          const filledPrompt = node.executionLogicPrompt
              .replace(/{input_data_stringified}/g, inputDataStringified)
              .replace(/{target_data_type}/g, targetDataType)
              .replace(/{target_port_name}/g, targetPortName)
              .replace(/{target_node_name}/g, targetNodeName)
              .replace(/{target_node_type}/g, targetNodeType);

          const { text, error: serviceError } = await llmService.generateText(filledPrompt, node.requiresWebSearch);
          if (serviceError) llmError = serviceError;
          else {
              try {
                  let cleanJsonStr = text.trim();
                  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
                  const match = cleanJsonStr.match(fenceRegex);
                  if (match && match[2]) cleanJsonStr = match[2].trim();

                  const parsedResult = JSON.parse(cleanJsonStr);
                  if (parsedResult?.output_data?.error) {
                      llmError = `Adapter Error: ${parsedResult.output_data.error}. Input type: ${parsedResult.output_data.original_input_type_detected}, Target type: ${parsedResult.output_data.requested_target_type}`;
                  } else if (parsedResult && parsedResult.hasOwnProperty('output_data')) {
                      resultData[node.outputs[0].id] = parsedResult.output_data;
                  } else {
                      llmError = "Adapter response missing 'output_data'.";
                  }
              } catch (parseError) {
                  llmError = `Error parsing Adapter LLM response: ${parseError instanceof Error ? parseError.message : String(parseError)}. Response: ${text.substring(0,100)}`;
              }
          }
          finalStatus = llmError ? 'error' : 'success';
      } else if (node.isDynamic && node.executionLogicPrompt) {
        let filledPrompt = node.executionLogicPrompt;
        for (const inputPort of node.inputs) {
          const placeholder = `{${inputPort.id}}`;
          let value = node.data[inputPort.id];
          if (typeof value !== 'string') {
            try { value = JSON.stringify(value); }
            catch { value = String(value); }
          }
          filledPrompt = filledPrompt.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value || '');
        }

        const { text, error: serviceError } = await llmService.generateText(filledPrompt, node.requiresWebSearch);
        if (serviceError) llmError = serviceError;
        else {
          if (node.outputs.length > 1) {
            try {
              let cleanJsonStr = text.trim();
              const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
              const match = cleanJsonStr.match(fenceRegex);
              if (match && match[2]) cleanJsonStr = match[2].trim();
              const parsedJson = JSON.parse(cleanJsonStr);
              if (typeof parsedJson === 'object' && parsedJson !== null) resultData = parsedJson;
              else throw new Error("LLM response not a JSON object.");
            } catch (e) {
              llmError = `Error parsing LLM JSON response for multiple outputs: ${e instanceof Error ? e.message : String(e)}. Response: ${text.substring(0,100)}`;
            }
          } else if (node.outputs.length === 1) {
            resultData[node.outputs[0].id] = text;
          }
        }
        finalStatus = llmError ? 'error' : 'success';
      } else {
          if (node.type === NodeType.DisplayData || node.type === NodeType.DisplayText || node.type === NodeType.DisplayImage || node.type === NodeType.Sketchpad) {
              finalStatus = 'success';
          } else {
              llmError = "Node type is not executable or logic prompt is missing.";
              finalStatus = 'error';
          }
      }

      const endTime = performance.now();
      const executionTime = ((endTime - startTime) / 1000).toFixed(2) + 's';

      if (llmError) {
        updateNodeInternalState(nodeId, {}, 'error', llmError, executionTime);
        finalStatus = 'error';
      } else {
        updateNodeInternalState(nodeId, resultData, 'success', null, executionTime);
        finalStatus = 'success';
      }
    } catch (error) {
      const endTime = performance.now();
      const executionTime = ((endTime - startTime) / 1000).toFixed(2) + 's';
      console.error(`Error executing node ${nodeId}:`, error);
      updateNodeInternalState(nodeId, {}, 'error', error instanceof Error ? error.message : String(error), executionTime);
      finalStatus = 'error';
    } finally {
        if (!isWorkflowRunning && highlightedNodeId === nodeId) {
            setHighlightedNodeId(null);
        }
    }
    return finalStatus;
  }, [nodes, edges, updateNodeInternalState, isWorkflowRunning, highlightedNodeId, activeDrawingToolNodeId]);

  const handleSaveLlmSettings = (newConfig: LlmServiceConfig) => {
    llmService.setConfiguration(newConfig);
    setLlmConfig(llmService.getConfiguration());
    setShowSettingsModal(false);
  };

  const handleDefineNewNode = async () => {
    if (!dynamicNodeDefinitionPrompt.trim()) {
        setNodeDefinitionError("Please describe the node you want to create.");
        return;
    }
    setIsDefiningNode(true);
    setNodeDefinitionError(null);
    try {
        const nodeConfig = await llmService.defineNodeFromPrompt(dynamicNodeDefinitionPrompt);
        if (nodeConfig) {
            const completeNodeConfig: DynamicNodeConfig = {
                ...nodeConfig,
                isDynamic: true,
                category: nodeConfig.category || "Custom Agents",
                currentWidth: nodeConfig.currentWidth || DEFAULT_NODE_WIDTH,
                currentHeight: nodeConfig.currentHeight || DEFAULT_NODE_HEIGHT,
            };
            setAvailableAgents(prev => [...prev, completeNodeConfig]);
            setDynamicNodeDefinitionPrompt('');
        } else {
            setNodeDefinitionError("LLM failed to return a valid node configuration. Check console for details.");
        }
    } catch (error) {
        console.error("Error defining new node:", error);
        setNodeDefinitionError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setIsDefiningNode(false);
    }
  };

  const clearCanvas = () => {
    setNodes([]);
    setEdges([]);
    setHighlightedNodeId(null);
    setActiveDrawingToolNodeId(null); // Release drawing lock
  };

  const handleCanvasDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (activeDrawingToolNodeId) return; // Prevent search menu if drawing lock active

    const target = event.target as HTMLElement;
    if (target.closest('.draggable-node, .port-handle, button, input, textarea, select, [data-resize-handle="true"]')) {
      return;
    }
    setSearchMenuViewportPosition({ x: event.clientX, y: event.clientY });
    setLastDoubleClickViewportPosition({ x: event.clientX, y: event.clientY });
    setShowSearchMenu(true);
  };

  const handleSelectAgentFromSearch = (agentConfig: DynamicNodeConfig, clickViewportPosition: Point) => {
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const worldX = (clickViewportPosition.x - canvasRect.left - appViewTransform.x) / appViewTransform.k;
    const worldY = (clickViewportPosition.y - canvasRect.top - appViewTransform.y) / appViewTransform.k;
    addNodeToCanvas(agentConfig, worldX, worldY);
    setShowSearchMenu(false);
  };

  const canvasRef = useRef<HTMLDivElement>(null);

  const handleViewTransformChange = useCallback((transform: { x: number, y: number, k: number }) => {
    setAppViewTransform(transform);
  }, []);

  const handleQueueWorkflowExecution = async () => {
    if (activeDrawingToolNodeId) return; // Prevent workflow execution if drawing lock active

    setIsWorkflowRunning(true);
    const nodeIdsToExecute = nodes.map(n => n.id);

    for (const nodeId of nodeIdsToExecute) {
        const currentNodeToExecute = nodes.find(n => n.id === nodeId);
        if (currentNodeToExecute) {
            const status = await executeNode(nodeId);
            if (status === 'error') {
                 console.warn(`Node ${nodeId} failed during workflow execution. Workflow continuing...`);
            }
        }
    }
    setIsWorkflowRunning(false);
    setHighlightedNodeId(null);
  };

  const llmStatusMessage = useMemo(() => {
    const config = llmService.getConfiguration();
    if (config.activeRuntime === 'gemini') {
      return GEMINI_API_KEY ? "Gemini Active" : "Gemini (No API Key)";
    } else if (config.activeRuntime === 'local_lm_studio') {
      return `LM Studio: ${config.localEndpoints.lm_studio.baseUrl || 'Not Set'}`;
    } else if (config.activeRuntime === 'local_ollama') {
      return `Ollama: ${config.localEndpoints.ollama.baseUrl || 'Not Set'}`;
    }
    return "LLM Not Configured";
  }, [llmConfig]);

  const isLocalLLMConfigured = useMemo(() => {
    const config = llmService.getConfiguration();
    if (config.activeRuntime === 'local_lm_studio') {
      return !!config.localEndpoints.lm_studio.baseUrl;
    } else if (config.activeRuntime === 'local_ollama') {
      return !!config.localEndpoints.ollama.baseUrl;
    }
    return false;
  }, [llmConfig]);


  const [tempLlmConfig, setTempLlmConfig] = useState<LlmServiceConfig>(llmService.getConfiguration());

  useEffect(() => {
    if (showSettingsModal) {
      setTempLlmConfig(llmService.getConfiguration());
    }
  }, [showSettingsModal]);

  const handleTempConfigChange = <K extends keyof LlmServiceConfig>(key: K, value: LlmServiceConfig[K]) => {
    setTempLlmConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleTempEndpointChange = (
    runtime: 'ollama' | 'lm_studio',
    field: keyof LocalEndpointSettings,
    value: string
  ) => {
    setTempLlmConfig(prev => ({
      ...prev,
      localEndpoints: {
        ...prev.localEndpoints,
        [runtime]: {
          ...prev.localEndpoints[runtime],
          [field]: value,
        },
      },
    }));
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-300">
      {/* Header */}
      <header className="bg-neutral-950 p-2 shadow-md flex items-center justify-between border-b-4 border-dotted border-neutral-800 space-x-2">
        <div className="flex items-center space-x-2">
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCAxMjAgMTIwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJnbG93R3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMDBCN0QwOyBzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojOGE0QkFFOyBzdG9wLW9wYWNpdHk6MSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8ZmlsdGVyIGlkPSJnbG93Ij4KICAgICAgPGZlR2F1c3NpYW5CbHVyIGluPSJTb3VyY2VBbHBoYSIgc3RkRGV2aWF0aW9uPSIzIiByZXN1bHQ9ImJsdXJhIiAvPgogICAgICA8ZmVDb252b2x2ZU1hdHJpeCBpbj0iYmx1cmEiIGtlcm5lbE1hdHJpeD0iMSAwIDAgMCAxIDAgMCAwIDAgMSIgLz4gCiAgICAgIDxmZUZsb29kIGZsb29kLWNvbG9yPSIjMEJEN0QwIiBmbG9vZC1vcGFjaXR5PSIwLjciIHJlc3VsdD0iZ2xvd0NvbG9yIiAvPgogICAgICA8ZmVDb21wb3NpdGUgaW49Imdsb3dDb2xvciIgaW4yPSJibHVyYSIgb3BlcmF0b3I9ImluIiByZXN1bHQ9ImNvbXBvc2l0ZWRCbHVyIiAvPgogICAgICA8ZmVDb21wb3NpdGUgaW49IlNvdXJjZUdyYXBoaWMiIGluMj0iY29tcG9zaXRlZEJsdXIiIG9wZXJhdG9yPSJvdmVybGF5IiAvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDYwIDYwKSBzY2FsZSgwLjgpIHRyYW5zbGF0ZSgtNjAgLTYwKSI+CiAgICAgIDxnIHN0eWxlPSJmaWx0ZXI6IHVybCgjZ2xvdyk7Ij4KICAgICAgICAgIDxwYXRoIGQ9Ik02MCAxMEExNSA1NSA5MCAwIDEgNjAgMjVBMTUgMTUgMjcwIDAgMSA2MCAxMFoiIGZpbGw9InVybCgjZ2xvd0dyYWRpZW50KSIgdHJhbnNmb3JtPSJyb3RhdGUoMzAgNjAgNjApIj4KICAgICAgICAgICAgPGFuaW1hdGVUcmFuc2Zvcm0gYXR0cmlidXRlTmFtZT0idHJhbnNmb3JtIiB0eXBlPSJyb3RhdGUiIGZyb209IjMwIDYwIDYwIiB0bz0iMzkyIDYwIDYwIiBkdXI9IjE1cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIC8+CiAgICAgICAgICA8L3BhdGg+CiAgICAgICAgICA8cGF0aCBkPSJNNjAgMTBBMTUgMTUgOTAgMCAxIDYwIDI1QTE1IDE1IDI3MCAwIDEgNjAgMTBaIiBmaWxsPSJ1cmwoI2dsb3dHcmFkaWVudCkiIHRyYW5zZm9ybT0icm90YXRlKDE1MCA2MCA2MCkiPgogICAgICAgICAgICA8YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIHR5cGU9InJvdGF0ZSIgZnJvbT0iMTUwIDYwIDYwIiB0bz0iNTEyIDYwIDYwIiBkdXI9IjE1cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIC8+CiAgICAgICAgICA8L3BhdGg+CiAgICAgICAgICA8cGF0aCBkPSJNNjAgMTBBMTUgMTUgOTAgMCAxIDYwIDI1QTE1IDE1IDI3MCAwIDEgNjAgMTBaIiBmaWxsPSJ1cmwoI2dsb3dHcmFkaWVudCkiIHRyYW5zZm9ybT0icm90YXRlKDI3MCA2MCA2MCkiPgogICAgICAgICAgICA8YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIHR5cGU9InJvdGF0ZSIgZnJvbT0iMjcwIDYwIDYwIiB0bz0iNjMyIDYwIDYwIiBkdXI9IjE1cyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIC8+CiAgICAgICAgICA8L3BhdGg+CiAgICAgICAgICA8Y2lyY2xlIGN4PSI2MCIgY3k9IjYwIiByPSIxMiIgZmlsbD0iIzFBMUYyQiIgc3Ryb2tlPSIjMEJEN0QwIiBzdHJva2Utd2lkdGg9IjIiLz4KICAgICAgICAgIDxjaXJjbGUgY3g9IjYwIiBjeT0iNjAiIHI9IjUiIGZpbGw9InVybCgjZ2xvd0dyYWRpZW50KSIvPgogICAgICA8L2c+CiAgPC9nPgo8L3N2Zz4=" alt="AgentricAI Logo" className="h-7 w-7" />
            <h1 className="text-xl font-bold text-sky-400">AgentricAI Studios</h1>
        </div>
        <div className="flex-grow"></div>
        <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-1 rounded-md ${GEMINI_API_KEY && llmConfig.activeRuntime === 'gemini' ? 'bg-green-600' : (llmConfig.activeRuntime === 'gemini' ? 'bg-red-600' : (isLocalLLMConfigured ? 'bg-sky-600' : 'bg-yellow-600'))}`}>
                {llmStatusMessage}
            </span>
            <button
                onClick={() => setShowSettingsModal(true)}
                className="p-1.5 rounded-md hover:bg-neutral-700 transition-colors disabled:opacity-50"
                title="LLM Settings"
                disabled={!!activeDrawingToolNodeId}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>
            <button
                onClick={handleQueueWorkflowExecution}
                disabled={isWorkflowRunning || nodes.length === 0 || !!activeDrawingToolNodeId}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                title="Run full workflow (nodes executed in order of addition)"
            >
                {isWorkflowRunning ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Running...
                  </div>
                ) : "Run Full Workflow"}
            </button>
            <button
                onClick={clearCanvas}
                disabled={!!activeDrawingToolNodeId}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                title="Clear all nodes and edges from the canvas"
            >
                Clear Canvas
            </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-grow flex relative" onDoubleClick={handleCanvasDoubleClick}>
        <CanvasComponent
          ref={canvasRef}
          nodes={nodes}
          edges={edges}
          onNodeDrag={handleNodeDrag}
          setNodes={setNodes}
          setEdges={setEdges}
          executeNode={executeNode}
          updateNodeInternalState={updateNodeInternalState}
          onRemoveNode={onRemoveNode}
          onViewTransformChange={handleViewTransformChange}
          highlightedNodeId={highlightedNodeId}
          activeDrawingToolNodeId={activeDrawingToolNodeId}
          setActiveDrawingToolNodeId={setActiveDrawingToolNodeId}
        />
        <FloatingSearchMenu
            isOpen={showSearchMenu}
            onClose={() => setShowSearchMenu(false)}
            position={searchMenuViewportPosition}
            agents={availableAgents}
            onSelectAgent={handleSelectAgentFromSearch}
            initialClickViewportPosition={lastDoubleClickViewportPosition}
        />
      </div>

      {/* Define New Node Section */}
      <div className="bg-neutral-950 p-3 shadow-md border-t-4 border-dotted border-neutral-800">
        <h3 className="text-md font-semibold mb-2 text-sky-400">Define New Agent/Node</h3>
        <div className="flex space-x-2 items-start">
            <textarea
                value={dynamicNodeDefinitionPrompt}
                onChange={(e) => setDynamicNodeDefinitionPrompt(e.target.value)}
                placeholder="Describe the node you want to create (e.g., 'A node that takes text and returns its sentiment as positive, negative, or neutral. Output should be JSON. Color blue, icon 😃'). The LLM will define its inputs, outputs, and execution logic."
                className="flex-grow p-2 bg-neutral-800 border border-neutral-700 rounded-md text-gray-200 focus:ring-sky-500 focus:border-sky-500 text-sm placeholder-gray-500 h-20 resize-none"
                disabled={!!activeDrawingToolNodeId}
            />
            <button
                onClick={handleDefineNewNode}
                disabled={isDefiningNode || !dynamicNodeDefinitionPrompt.trim() || !!activeDrawingToolNodeId}
                className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 h-20"
            >
                {isDefiningNode ? 'Defining...' : 'Define Node'}
            </button>
        </div>
        {nodeDefinitionError && <p className="text-red-500 text-xs mt-1">{nodeDefinitionError}</p>}
      </div>


      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 p-6 rounded-lg shadow-2xl w-full max-w-lg border-4 border-dotted border-neutral-800">
            <h2 className="text-xl font-semibold mb-6 text-sky-400">LLM Settings</h2>

            <div className="space-y-6">
              <div>
                <label htmlFor="llmRuntime" className="block text-sm font-medium text-gray-300 mb-1">Active LLM Runtime:</label>
                <select
                  id="llmRuntime"
                  value={tempLlmConfig.activeRuntime}
                  onChange={(e) => handleTempConfigChange('activeRuntime', e.target.value as LlmRuntimeType)}
                  className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded-md text-gray-200 focus:ring-sky-500 focus:border-sky-500 text-sm"
                >
                  <option value="gemini" disabled={!GEMINI_API_KEY}>Gemini (Cloud - API Key {GEMINI_API_KEY ? 'Present' : 'Missing'})</option>
                  <option value="local_lm_studio">LM Studio (Local)</option>
                  <option value="local_ollama">Ollama (Local)</option>
                </select>
                {!GEMINI_API_KEY && tempLlmConfig.activeRuntime === 'gemini' && (
                    <p className="text-xs text-red-500 mt-1">Gemini API Key (process.env.API_KEY) is not configured. Please set it up or choose a local LLM.</p>
                )}
              </div>

              {/* LM Studio Settings */}
              {(tempLlmConfig.activeRuntime === 'local_lm_studio') && (
                <div className="p-4 border border-neutral-700 rounded-md space-y-3 bg-neutral-850">
                  <h3 className="text-md font-semibold text-sky-500">LM Studio Configuration</h3>
                  <div>
                    <label htmlFor="lmStudioUrl" className="block text-xs font-medium text-gray-400 mb-1">Base URL:</label>
                    <input
                      type="text"
                      id="lmStudioUrl"
                      value={tempLlmConfig.localEndpoints.lm_studio.baseUrl}
                      onChange={(e) => handleTempEndpointChange('lm_studio', 'baseUrl', e.target.value)}
                      placeholder="e.g., http://localhost:1234/v1"
                      className="w-full p-2 bg-neutral-700 border border-neutral-600 rounded-md text-gray-200 focus:ring-sky-500 focus:border-sky-500 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="lmStudioModel" className="block text-xs font-medium text-gray-400 mb-1">Model Name (optional, from server):</label>
                    <input
                      type="text"
                      id="lmStudioModel"
                      value={tempLlmConfig.localEndpoints.lm_studio.modelName || ''}
                      onChange={(e) => handleTempEndpointChange('lm_studio', 'modelName', e.target.value)}
                      placeholder="e.g., loaded-model-name (often not needed)"
                      className="w-full p-2 bg-neutral-700 border border-neutral-600 rounded-md text-gray-200 focus:ring-sky-500 focus:border-sky-500 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Ollama Settings */}
              {(tempLlmConfig.activeRuntime === 'local_ollama') && (
                <div className="p-4 border border-neutral-700 rounded-md space-y-3 bg-neutral-850">
                  <h3 className="text-md font-semibold text-sky-500">Ollama Configuration</h3>
                  <div>
                    <label htmlFor="ollamaUrl" className="block text-xs font-medium text-gray-400 mb-1">Base URL:</label>
                    <input
                      type="text"
                      id="ollamaUrl"
                      value={tempLlmConfig.localEndpoints.ollama.baseUrl}
                      onChange={(e) => handleTempEndpointChange('ollama', 'baseUrl', e.target.value)}
                      placeholder="e.g., http://localhost:11434/v1"
                      className="w-full p-2 bg-neutral-700 border border-neutral-600 rounded-md text-gray-200 focus:ring-sky-500 focus:border-sky-500 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="ollamaModel" className="block text-xs font-medium text-gray-400 mb-1">Model Name:</label>
                    <input
                      type="text"
                      id="ollamaModel"
                      value={tempLlmConfig.localEndpoints.ollama.modelName || ''}
                      onChange={(e) => handleTempEndpointChange('ollama', 'modelName', e.target.value)}
                      placeholder="e.g., llama3:latest, gemma:latest"
                      className="w-full p-2 bg-neutral-700 border border-neutral-600 rounded-md text-gray-200 focus:ring-sky-500 focus:border-sky-500 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end space-x-3">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-neutral-700 hover:bg-neutral-600 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveLlmSettings(tempLlmConfig)}
                className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgenticStudioApp;