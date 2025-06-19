
import { GoogleGenAI, GenerateContentResponse, GroundingMetadata } from "@google/genai";
import type { DynamicNodeConfig, LlmRuntimeType, LlmServiceConfig, LocalEndpointSettings } from '../core/types';

const API_KEY = process.env.API_KEY;

if (!API_KEY && !localStorage.getItem('llmServiceConfig')) { // Only warn if no API key AND no saved local config
  console.warn("Gemini API key (process.env.API_KEY) not found. Gemini functionality will be disabled unless a local LLM is configured or API_KEY is provided.");
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

// Default configuration
const defaultConfig: LlmServiceConfig = {
  activeRuntime: API_KEY ? 'gemini' : 'local_lm_studio', // Default to local if no Gemini key
  localEndpoints: {
    ollama: { baseUrl: 'http://localhost:11434/v1', modelName: 'gemma:latest' },
    lm_studio: { baseUrl: 'http://localhost:1234/v1', modelName: 'local-model' }
  }
};

let currentConfig: LlmServiceConfig = defaultConfig;
try {
    const storedConfig = localStorage.getItem('llmServiceConfig');
    if (storedConfig) {
        const parsedConfig = JSON.parse(storedConfig);
        currentConfig = {
            ...defaultConfig,
            ...parsedConfig,
            localEndpoints: {
                ollama: { ...defaultConfig.localEndpoints.ollama, ...parsedConfig.localEndpoints?.ollama },
                lm_studio: { ...defaultConfig.localEndpoints.lm_studio, ...parsedConfig.localEndpoints?.lm_studio }
            }
        };
        // Ensure activeRuntime reflects API key status if not explicitly set by user config
        if (!parsedConfig.activeRuntime && !API_KEY) {
            currentConfig.activeRuntime = 'local_lm_studio';
        } else if (!parsedConfig.activeRuntime && API_KEY) {
            currentConfig.activeRuntime = 'gemini';
        }
    } else {
        // If no stored config, ensure default reflects API key status
        if (!API_KEY) {
            currentConfig.activeRuntime = 'local_lm_studio';
        } else {
            currentConfig.activeRuntime = 'gemini';
        }
    }
} catch (e) {
    console.error("Failed to load or parse LLM config from localStorage", e);
    currentConfig = defaultConfig;
    // Adjust default config based on API_KEY presence after error
    if (!API_KEY) {
        currentConfig.activeRuntime = 'local_lm_studio';
    } else {
        currentConfig.activeRuntime = 'gemini';
    }
}


export const llmService = {
  getConfiguration: (): LlmServiceConfig => {
    return JSON.parse(JSON.stringify(currentConfig)); // Return a deep copy
  },

  setConfiguration: (config: Partial<LlmServiceConfig>) => {
    const newConfig = {
        ...currentConfig,
        ...config,
        localEndpoints: {
            ollama: {
                ...currentConfig.localEndpoints.ollama,
                ...config.localEndpoints?.ollama,
            },
            lm_studio: {
                ...currentConfig.localEndpoints.lm_studio,
                ...config.localEndpoints?.lm_studio,
            },
        },
    };
    currentConfig = newConfig;
    try {
        localStorage.setItem('llmServiceConfig', JSON.stringify(currentConfig));
    } catch (e) {
        console.error("Failed to save LLM config to localStorage", e);
    }
    console.log("LLM Service Configuration Updated:", currentConfig);
  },

  generateText: async (prompt: string, enableWebSearch: boolean = false): Promise<{ text: string; groundingMetadata?: GroundingMetadata | null; error?: string }> => {
    if (currentConfig.activeRuntime === 'gemini') {
      if (!ai) return { text: "", error: "Gemini API Key (process.env.API_KEY) not configured or client not initialized." };
      try {
        const geminiConfig: any = {};
        if (enableWebSearch) {
          geminiConfig.tools = [{googleSearch: {}}];
        }
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-04-17',
          contents: prompt,
          ...(Object.keys(geminiConfig).length > 0 && { config: geminiConfig }),
        });
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata || null;
        return { text: response.text, groundingMetadata };
      } catch (error) {
        console.error("Error in generateText with Gemini:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { text: "", error: `Gemini Error: ${errorMessage}`, groundingMetadata: null };
      }
    } else if (currentConfig.activeRuntime === 'local_lm_studio' || currentConfig.activeRuntime === 'local_ollama') {
      const isLmStudio = currentConfig.activeRuntime === 'local_lm_studio';
      const endpointSettings = isLmStudio ? currentConfig.localEndpoints.lm_studio : currentConfig.localEndpoints.ollama;
      const runtimeName = isLmStudio ? "LM Studio" : "Ollama";

      if (!endpointSettings.baseUrl) return { text: "", error: `${runtimeName} endpoint URL not configured.` };
      
      try {
        const modelName = endpointSettings.modelName || (isLmStudio ? "local-model" : "gemma:latest");
        const requestBody = {
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        };
        const cleanBaseUrl = endpointSettings.baseUrl.replace(/\/$/, ''); // Remove trailing slash if present
        const url = `${cleanBaseUrl}/chat/completions`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`LOCAL_LLM_ERROR: Network response was not ok (${response.status}) from ${runtimeName}: ${errorData}`);
        }
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        if (!text && data.error) {
            throw new Error(`LOCAL_LLM_ERROR: ${data.error.message || `Unknown error from ${runtimeName}.`}`);
        }
        return { text, groundingMetadata: null };
      } catch (error) {
        console.error(`Error in generateText with ${runtimeName}:`, error); // Keep original console error for dev
        let detailErrorMessage = error instanceof Error ? error.message : String(error);
        if (detailErrorMessage.toLowerCase().includes("failed to fetch")) {
            detailErrorMessage += ` (Hint: This often means the local server at ${endpointSettings.baseUrl} is not running, not reachable, or a CORS policy is preventing the connection. Check your local server's console and ensure it's configured to accept requests from this application's origin.)`;
        }
        const finalUserErrorMessage = detailErrorMessage.startsWith("LOCAL_LLM_ERROR:") ? detailErrorMessage : `${runtimeName} Error: ${detailErrorMessage}`;
        return { text: "", error: finalUserErrorMessage, groundingMetadata: null };
      }
    }
    return { text: "", error: "Unknown LLM runtime configured." };
  },

  generateImage: async (prompt: string, localModelIdentifier?: string): Promise<string> => {
    if (currentConfig.activeRuntime === 'gemini') {
      if (!ai) return "Error: Gemini API Key (process.env.API_KEY) not configured or client not initialized for image generation.";
      try {
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: prompt,
            config: {numberOfImages: 1, outputMimeType: 'image/jpeg'},
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image?.imageBytes) {
          return `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
        }
        return "Error: No image generated by Gemini, or image data is missing.";
      } catch (error) {
        console.error("Error in generateImage with Gemini:", error);
        return `Error generating image with Gemini: ${error instanceof Error ? error.message : String(error)}`;
      }
    } else if (currentConfig.activeRuntime === 'local_lm_studio' || currentConfig.activeRuntime === 'local_ollama') {
      const isLmStudio = currentConfig.activeRuntime === 'local_lm_studio';
      const endpointSettings = isLmStudio ? currentConfig.localEndpoints.lm_studio : currentConfig.localEndpoints.ollama;
      const runtimeName = isLmStudio ? "LM Studio" : "Ollama";

      if (!endpointSettings.baseUrl) return `Error: ${runtimeName} endpoint URL not configured.`;
      if (!localModelIdentifier) {
        return `Error: For local image generation with ${runtimeName}, connect a 'Local Model File Selector' node to the 'Local Model ID' input of the Image Generator node, or ensure your local server is configured with a default image model.`;
      }
      
      try {
        const requestBody = {
          model: localModelIdentifier, 
          prompt: prompt,
          n: 1,
          size: "512x512", 
          response_format: "b64_json",
        };
        const cleanBaseUrl = endpointSettings.baseUrl.replace(/\/$/, ''); // Remove trailing slash if present
        const url = `${cleanBaseUrl}/images/generations`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`LOCAL_IMAGE_GEN_ERROR: Network response was not ok (${response.status}) from ${runtimeName} image endpoint: ${errorData}`);
        }
        const data = await response.json();
        if (data.data && data.data[0] && data.data[0].b64_json) {
          return `data:image/jpeg;base64,${data.data[0].b64_json}`;
        }
        throw new Error(`LOCAL_IMAGE_GEN_ERROR: ${runtimeName} image endpoint response did not contain expected image data format.`);
      } catch (error) {
        console.error(`Error in generateImage with ${runtimeName} (${localModelIdentifier}):`, error); // Keep original console error
        let detailErrorMessage = error instanceof Error ? error.message : String(error);
        if (detailErrorMessage.toLowerCase().includes("failed to fetch")) {
            detailErrorMessage += ` (Hint: This often means the local server at ${endpointSettings.baseUrl} is not running, not reachable, or a CORS policy is preventing the connection. Check your local server's console and ensure it's configured to accept requests from this application's origin.)`;
        }
        const finalUserErrorMessage = detailErrorMessage.startsWith("LOCAL_IMAGE_GEN_ERROR:") ? detailErrorMessage : `${runtimeName} Image Gen Error: ${detailErrorMessage}`;
        return finalUserErrorMessage;
      }
    }
    return "Error: Unknown LLM runtime for image generation.";
  },

  defineNodeFromPrompt: async (userDescription: string): Promise<DynamicNodeConfig | null> => {
    const systemInstruction = `You are an AI assistant that helps define new functional nodes for a visual workflow application called Agentric AI Studios.
Based on the user's description, provide a JSON object defining the node.
The JSON object MUST have the following properties:
- "name": A concise, descriptive name for the node (e.g., "Text Summarizer", "Sentiment Analyzer"). Max 3 words.
- "description": A short explanation (max 15 words) of what the node does.
- "inputs": An array of input port objects. Each input port object must have:
    - "id": A unique snake_case string identifier for the port (e.g., "text_in", "image_data").
    - "name": A user-friendly name for the port (e.g., "Text to Summarize", "Input Image"). Max 3 words.
    - "dataType": The expected data type for this input. Supported types: 'text', 'image', 'number', 'boolean', 'json', 'any'.
    - "exampleValue": (Optional) A simple example value for this input, matching its dataType. For booleans, use true or false. For numbers, use a digit. For text, a short string. For JSON, a very simple valid JSON string like '{"key": "value"}'.
- "outputs": An array of output port objects. Each output port object must have:
    - "id": A unique snake_case string identifier for the port (e.g., "summary_out", "sentiment_score").
    - "name": A user-friendly name for the port (e.g., "Summary", "Sentiment"). Max 3 words.
    - "dataType": The data type of the output from this port.
- "executionLogicPrompt": A template string that will be used as a prompt for an LLM when an instance of this node is executed. This prompt should clearly state the task to be performed.
    - Use placeholders like {input_port_id} for where input data should be injected. For example, if an input port has id "text_in", the placeholder should be "{text_in}".
    - **IMPORTANT FOR MULTIPLE OUTPUTS**: If the node you are defining has MORE THAN ONE output port in the "outputs" array, the 'executionLogicPrompt' you generate MUST instruct the runtime LLM to return its result as a single, valid JSON object. The keys of this JSON object MUST exactly match the "id" fields of the "outputs" you define, and the values should be the corresponding data for each output port.
      Example for multiple outputs: If outputs are [{"id": "text_data", "name": "Text", "dataType":"text"}, {"id": "number_data", "name":"Count", "dataType":"number"}], the executionLogicPrompt should end with something like: "Provide your response as a JSON object with keys 'text_data' and 'number_data'."
    - If the node has only ONE output port, the LLM can return plain text, which will be assigned to that single output.
- "color": A Tailwind CSS background color class (e.g., "bg-sky-600", "bg-amber-500"). Choose a color that fits the node's function.
- "icon": A single emoji character to represent the node (e.g., "📄", "📊").
- "requiresWebSearch": (Optional) A boolean (true/false). Set to true if the node's primary function involves fetching or referencing current information from the web (e.g., "Current Weather Reporter", "Latest News Summarizer"). Defaults to false if omitted.

Constraints:
- Node names, port names should be concise.
- Port IDs must be unique within their respective 'inputs' or 'outputs' array for a given node definition.
- Ensure 'executionLogicPrompt' correctly references the 'id' fields of the 'inputs'.

User's node description: "${userDescription}"
Provide ONLY the JSON object in your response. Ensure the JSON is valid.`;

    const parseAndValidateNodeConfig = (jsonStr: string, llmName: string): DynamicNodeConfig | null => {
        let cleanJsonStr = jsonStr.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = cleanJsonStr.match(fenceRegex);
        if (match && match[2]) { cleanJsonStr = match[2].trim(); }
        
        try {
            const parsedData = JSON.parse(cleanJsonStr) as DynamicNodeConfig;
            if (parsedData && typeof parsedData === 'object' && 
                parsedData.name && parsedData.description && 
                Array.isArray(parsedData.inputs) && Array.isArray(parsedData.outputs) && 
                parsedData.executionLogicPrompt && parsedData.color && parsedData.icon) {
              if (parsedData.requiresWebSearch === undefined) {
                parsedData.requiresWebSearch = false;
              }
              if (parsedData.inputs) {
                for (const input of parsedData.inputs) {
                  if (input.exampleValue !== undefined) {
                    if (input.dataType === 'number' && typeof input.exampleValue !== 'number') {
                       console.warn(`Fixing exampleValue for ${input.id} in ${parsedData.name}: expected number, got ${typeof input.exampleValue}. Setting to 0.`);
                       input.exampleValue = 0;
                    } else if (input.dataType === 'boolean' && typeof input.exampleValue !== 'boolean') {
                       console.warn(`Fixing exampleValue for ${input.id} in ${parsedData.name}: expected boolean, got ${typeof input.exampleValue}. Setting to false.`);
                       input.exampleValue = false;
                    } else if (input.dataType === 'json') {
                        try {
                            if (typeof input.exampleValue !== 'string' || !String(input.exampleValue).trim().startsWith('{') && !String(input.exampleValue).trim().startsWith('[')) {
                               throw new Error("Not a JSON string structure");
                            }
                            JSON.parse(String(input.exampleValue));
                        } catch (e) {
                            console.warn(`Fixing exampleValue for ${input.id} in ${parsedData.name}: expected valid JSON string, got '${input.exampleValue}'. Setting to '{"valid":true}'. Error: ${(e as Error).message}`);
                            input.exampleValue = '{"valid":true}';
                        }
                    }
                  }
                }
              }
              return parsedData;
            } else { 
                console.error(`Error in defineNodeFromPrompt (${llmName}): Parsed JSON from LLM is missing required fields or is not structured as DynamicNodeConfig:`, parsedData);
                return null;
            }
        } catch (e) {
             console.error(`