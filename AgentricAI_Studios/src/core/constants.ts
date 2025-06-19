

import { NodeType, PortDefinition } from './types';
import type { DynamicNodeConfig } from './types'; // Ensure DynamicNodeConfig is imported for type usage

export const DEFAULT_NODE_WIDTH = 220; // Standard width for nodes
export const DEFAULT_NODE_HEIGHT = 100; // Base height, will grow with ports
export const MIN_NODE_WIDTH = 180;
export const MIN_NODE_HEIGHT = 80;

export const NODE_HEADER_HEIGHT = 36; // Height of the node title bar
export const PORT_HEIGHT = 25;      // Approximate height allocated per port visually
export const PORT_WIDTH = 12;       // Visual width of the port circle

// Configuration for statically defined nodes
// We use a more specific type here that includes category
interface StaticNodeConfigEntry {
    inputs: PortDefinition[];
    outputs: PortDefinition[];
    color: string;
    icon?: React.ReactNode | string;
    description?: string;
    category: string; // Add category here
    requiresWebSearch?: boolean; // Added for consistency
}

export const NODE_CONFIG: Record<NodeType, StaticNodeConfigEntry> = {
  [NodeType.TextInput]: {
    inputs: [],
    outputs: [{ id: 'text_out', name: 'Text', type: 'output', dataType: 'text' }],
    color: 'bg-blue-600',
    icon: '📝',
    description: 'Provides a text input field.',
    category: "Input"
  },
  [NodeType.GeminiPrompt]: {
    inputs: [{ id: 'prompt_in', name: 'Prompt', type: 'input', dataType: 'text' }],
    outputs: [{ id: 'response_out', name: 'Response', type: 'output', dataType: 'text' }],
    color: 'bg-purple-600',
    icon: '✨',
    description: 'Sends a prompt to Gemini and outputs its text response.',
    category: "AI / LLM",
    requiresWebSearch: false, // Default, can be overridden by node instance
  },
  [NodeType.LocalLLMPrompt]: {
    inputs: [{ id: 'prompt_in', name: 'Prompt', type: 'input', dataType: 'text' }],
    outputs: [{ id: 'response_out', name: 'Response', type: 'output', dataType: 'text' }],
    color: 'bg-orange-600',
    icon: '🧠',
    description: 'Sends a prompt to the configured local LLM (LM Studio/Ollama) and outputs its text response.',
    category: "AI / LLM",
    requiresWebSearch: false,
  },
  [NodeType.ImageGenerator]: {
    inputs: [
        { id: 'prompt_in', name: 'Prompt', type: 'input', dataType: 'text' },
        { id: 'local_model_identifier_in', name: 'Local Model ID', type: 'input', dataType: 'text', exampleValue: "your_model.safetensors" } // New optional input
    ],
    outputs: [{ id: "image_out", name: "Image", type: "output", dataType: "image" }],
    color: 'bg-teal-600',
    icon: '🖼️',
    description: 'Generates an image. For local models, connect a "Local Model File Selector".',
    category: "AI / LLM"
  },
  [NodeType.DisplayData]: {
    inputs: [{ id: 'data_in', name: 'Data', type: 'input', dataType: 'any' }],
    outputs: [],
    color: 'bg-green-600',
    icon: '📺',
    description: 'Displays any connected data, formatting objects/arrays as JSON.',
    category: "Display"
  },
  [NodeType.DisplayImage]: {
    inputs: [{ id: 'image_in', name: 'Image', type: 'input', dataType: 'image' }],
    outputs: [],
    color: 'bg-lime-600',
    icon: '🏞️',
    description: 'Displays an input image.',
    category: "Display"
  },
  [NodeType.DisplayText]: {
    inputs: [{ id: 'text_in', name: 'Text', type: 'input', dataType: 'text' }],
    outputs: [],
    color: 'bg-slate-500',
    icon: '📄',
    description: 'Displays input text content.',
    category: "Display"
  },
  [NodeType.Sketchpad]: {
    inputs: [],
    outputs: [{ id: 'sketch_image_out', name: 'Sketch Output', type: 'output', dataType: 'image' }],
    color: 'bg-stone-500',
    icon: '✏️',
    description: 'A canvas for freehand drawing or sketching.',
    category: "Creative"
  },
  [NodeType.LocalModelFileSelector]: { 
    inputs: [],
    outputs: [{ id: 'model_identifier_out', name: 'Model Identifier', type: 'output', dataType: 'text' }],
    color: 'bg-gray-600',
    icon: '📂',
    description: 'Selects a local model file and outputs its name.',
    category: "Input"
  },
  [NodeType.MultiPromptNode]: {
    inputs: [
      { id: 'prompt_part_1', name: 'Part 1', type: 'input', dataType: 'any', exampleValue: "This is " },
      { id: 'prompt_part_2', name: 'Part 2', type: 'input', dataType: 'any', exampleValue: "a multi-part " },
      { id: 'prompt_part_3', name: 'Part 3', type: 'input', dataType: 'any', exampleValue: "prompt " },
      { id: 'prompt_part_4', name: 'Part 4', type: 'input', dataType: 'any', exampleValue: "example." },
      { id: 'prompt_part_5', name: 'Part 5', type: 'input', dataType: 'any', exampleValue: "" },
    ],
    outputs: [{ id: 'assembled_prompt_out', name: 'Assembled Prompt', type: 'output', dataType: 'text' }],
    color: 'bg-slate-600',
    icon: '🧩',
    description: 'Combines up to 5 inputs of any type into a single text prompt output, separated by spaces.',
    category: "Utility"
  },
};

export const DEFAULT_DYNAMIC_NODE_COLOR = 'bg-yellow-600';
export const DEFAULT_DYNAMIC_NODE_ICON = '🤖';

export const CODE_LANGUAGES = [
  "Python", "JavaScript", "Java", "CSharp", "CPlusPlus",
  "HTML", "CSS", "JSON", "XML", "SQL", "Markdown",
  "Shell", "Go", "Ruby", "PHP", "Swift", "Kotlin", "PlantUML", "Text"
];

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2.0;
export const ZOOM_SENSITIVITY = 0.0015;
export const WORLD_WIDTH = 5000; // Conceptual world size
export const WORLD_HEIGHT = 5000;


// Data type colors (Tailwind background classes for port pills)
export const DATA_TYPE_COLORS: Record<PortDefinition['dataType'], string> = {
  text: 'bg-sky-500',
  image: 'bg-lime-500',
  number: 'bg-amber-500',
  boolean: 'bg-rose-500',
  json: 'bg-fuchsia-500',
  any: 'port-any-gradient', // Special class for 'any' type
};

// Data type colors (Hex/RGB for SVG strokes on edges)
export const DATA_TYPE_STROKE_COLORS: Record<PortDefinition['dataType'], string> = {
  text: '#0ea5e9',    // sky-500
  image: '#84cc16',   // lime-500
  number: '#f59e0b',  // amber-500
  boolean: '#f43f5e', // rose-500
  json: '#d946ef',    // fuchsia-500
  any: '#6b7280',     // gray-500 (default for 'any' if one port is 'any')
};

export const ANY_TYPE_PORT_COLOR = 'port-any-gradient'; // For the port pill itself
export const DEFAULT_EDGE_COLOR = '#6b7280'; // gray-500, for any-to-any or default