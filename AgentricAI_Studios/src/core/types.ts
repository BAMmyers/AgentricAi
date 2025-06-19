

import type { ReactNode } from "react";

// Enum for built-in, non-dynamic node types
export enum NodeType {
  TextInput = 'Text Input',
  GeminiPrompt = 'Gemini Prompt',
  LocalLLMPrompt = 'Local LLM Prompt', // New Node Type
  DisplayData = 'Display Data',
  ImageGenerator = 'Image Generator',
  DisplayImage = 'Display Image',
  DisplayText = 'Display Text',
  Sketchpad = 'Sketchpad',
  LocalModelFileSelector = 'Local Model File Selector',
  MultiPromptNode = 'Multi-Prompt Node', // Added new node type
}

export interface Port {
  id: string;
  name: string;
  type: 'input' | 'output';
  dataType: 'text' | 'image' | 'number' | 'boolean' | 'json' | 'any';
  exampleValue?: string | number | boolean | null | Record<string, any>;
}

// Used when defining a node type (static or dynamic)
// For DynamicNodeConfig, this is used directly. For static nodes, it's part of NODE_CONFIG
export interface PortDefinition {
  id?: string; // Optional: if not provided, can be auto-generated
  name: string;
  type: 'input' | 'output';
  dataType: 'text' | 'image' | 'number' | 'boolean' | 'json' | 'any';
  exampleValue?: string | number | boolean | null | Record<string, any>;
}

export interface NodeData {
  id: string;
  type: string; // Can be NodeType enum or a dynamic node name from DynamicNodeConfig
  name: string; // User-friendly name, often same as type for dynamic nodes
  x: number;
  y: number;
  inputs: Port[];
  outputs: Port[];
  data: {
    [key: string]: any; // For storing node-specific data like input values, output results
  };
  isDynamic: boolean; // True if defined by DynamicNodeConfig, now non-optional
  executionLogicPrompt?: string; // For dynamic nodes
  color?: string; // Background color (e.g., Tailwind class)
  icon?: ReactNode | string; // Icon (emoji or ReactNode like SVG)
  requiresWebSearch?: boolean;
  currentWidth?: number;
  currentHeight?: number;
  status: 'idle' | 'running' | 'success' | 'error'; // Status of node execution
  error?: string; // Error message if execution failed
  category?: string; // Category for sidebar organization
  executionTime?: string; // Time taken for execution
}

export interface Edge {
  id: string;
  sourceNodeId: string;
  sourceOutputId: string;
  targetNodeId: string;
  targetInputId: string;
}

export interface Point {
  x: number;
  y: number;
}

// Configuration for LLM-defined dynamic nodes (Juggernauts, user-defined)
export interface DynamicNodeConfig {
  name: string; // This will act as the NodeType for these dynamic nodes
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  executionLogicPrompt?: string; // Prompt template for LLM execution
  color: string; // Suggested TailwindCSS color e.g. bg-purple-600
  icon: ReactNode | string; // Suggested emoji character OR ReactNode for custom icons
  isJuggernaut?: boolean;
  isAdministrative?: boolean;
  requiresWebSearch?: boolean;
  isDynamic: boolean; // Explicitly states if the node config is for a dynamic or static type node.
  category?: string; // Category for sidebar organization
  currentWidth?: number; // Default width for this node type
  currentHeight?: number; // Default height for this node type
}

export type LlmRuntimeType = 'gemini' | 'local_ollama' | 'local_lm_studio';

export interface LocalEndpointSettings {
  baseUrl: string;
  modelName?: string; // Optional, as some servers derive model from URL or have a default
}

export interface LlmServiceConfig {
  activeRuntime: LlmRuntimeType;
  localEndpoints: {
    ollama: LocalEndpointSettings;
    lm_studio: LocalEndpointSettings;
  };
}


export const MAX_DATA_CONNECTOR_INPUTS = 10;
export type CodeLanguageType =
  | "Python" | "JavaScript" | "Java" | "CSharp" | "CPlusPlus"
  | "HTML" | "CSS" | "JSON" | "XML" | "SQL" | "Markdown"
  | "Shell" | "Go" | "Ruby" | "PHP" | "Swift" | "Kotlin" | "PlantUML" | "Text";

// Props for components
export interface NodeComponentProps {
  node: NodeData;
  executeNode: (nodeId: string) => Promise<NodeData['status']>;
  updateNodeInternalState: (nodeId: string, dataChanges: Partial<NodeData['data']>, status?: NodeData['status'], error?: string | null, executionTime?: string) => void;
  onCloseNode: (nodeId: string) => void;
  isHighlighted?: boolean;
  activeDrawingToolNodeId: string | null;
  setActiveDrawingToolNodeId: (nodeId: string | null) => void;
}

export interface CanvasComponentProps {
  nodes: NodeData[];
  edges: Edge[];
  onNodeDrag: (nodeId: string, x: number, y: number) => void;
  setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  executeNode: (nodeId: string) => Promise<NodeData['status']>;
  updateNodeInternalState: (nodeId: string, dataChanges: Partial<NodeData['data']>, status?: NodeData['status'], error?: string | null, executionTime?: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onViewTransformChange: (transform: { x: number, y: number, k: number }) => void;
  highlightedNodeId?: string | null;
  activeDrawingToolNodeId: string | null;
  setActiveDrawingToolNodeId: (nodeId: string | null) => void;
}