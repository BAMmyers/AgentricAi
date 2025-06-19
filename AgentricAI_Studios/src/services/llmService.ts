

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

const getEnhancedLocalLlmErrorHint = (baseUrl: string, runtimeName: string): string => {
    return ` (Hint: This often means the ${runtimeName} server at ${baseUrl} is not running, not reachable, or a CORS policy is preventing the connection. Please verify the server is active, the 'Base URL' in AgentricAI Studios settings ('${baseUrl}') is correct, and check the ${runtimeName} server's own console logs for any specific error messages.)`;
};

const processLocalLlmError = async (response: Response, runtimeName: string, endpointUrl: string): Promise<string> => {
    let errorResponseMessage = `Network response was not ok (${response.status} ${response.statusText}) from ${runtimeName} at ${endpointUrl}.`;
    try {
      const errorBodyText = await response.text();
      // Try to parse as JSON to extract a more specific message
      try {
        const errorJson = JSON.parse(errorBodyText);
        if (errorJson && errorJson.error && typeof errorJson.error === 'string') { // Ollama error structure or LM Studio context error
          errorResponseMessage = `Error from ${runtimeName} (${response.status} ${response.statusText}): ${errorJson.error}`;
        } else if (errorJson && errorJson.error && errorJson.error.message) { // OpenAI/LM Studio like structure
          errorResponseMessage = `Error from ${runtimeName} (${response.status} ${response.statusText}): ${errorJson.error.message}`;
        } else if (errorJson && errorJson.message) { // Other possible structures
          errorResponseMessage = `Error from ${runtimeName} (${response.status} ${response.statusText}): ${errorJson.message}`;
        } else {
          errorResponseMessage += ` Server response: ${errorBodyText.substring(0, 500)}${errorBodyText.length > 500 ? '...' : ''}`;
        }
      } catch (jsonParseError) {
        // If JSON parsing fails, use the raw text (already included in the snippet)
        errorResponseMessage += ` Server response: ${errorBodyText.substring(0, 500)}${errorBodyText.length > 500 ? '...' : ''}`;
      }
    } catch (textError) {
      errorResponseMessage += ` Could not retrieve detailed error message from ${runtimeName} response.`;
    }
    return errorResponseMessage;
  };


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
      
      const cleanBaseUrl = endpointSettings.baseUrl.replace(/\/$/, ''); 
      const url = `${cleanBaseUrl}/chat/completions`;

      try {
        const modelName = endpointSettings.modelName || (isLmStudio ? "local-model" : "gemma:latest"); // Ensure default if not set
        const requestBody: any = {
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        };

        if (isLmStudio) {
            requestBody.stream = false;
            // For LM Studio, max_tokens = -1 implies no limit, or infinity.
            // However, to avoid potential issues with extremely long outputs for very short context models,
            // it might be safer to set a high, but finite, limit or rely on server defaults if -1 causes issues.
            // For now, retaining -1 as it's a common convention for "unlimited" in some LM Studio setups.
            requestBody.max_tokens = -1; 
        } else { // Ollama
            // Ollama specific parameters if needed, for now relying on defaults or model-specific settings.
            // requestBody.options = { num_predict: -1 }; // Example: Ollama's equivalent for max tokens
        }


        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const detailedError = await processLocalLlmError(response, runtimeName, url);
          throw new Error(`LOCAL_LLM_ERROR: ${detailedError}`);
        }
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";

        if (!text && data.error) {
            let errorMessage = "Unknown error";
            if (typeof data.error === 'string') errorMessage = data.error;
            else if (data.error.message && typeof data.error.message === 'string') errorMessage = data.error.message;
            throw new Error(`LOCAL_LLM_ERROR: ${runtimeName} reported: ${errorMessage}`);
        }
        if (!text && !data.choices?.[0]?.message) {
             throw new Error(`LOCAL_LLM_ERROR: Unexpected response structure from ${runtimeName}. No message content found.`);
        }
        return { text, groundingMetadata: null };
      } catch (error) {
        console.error(`Error in generateText with ${runtimeName}:`, error);
        let detailErrorMessage = error instanceof Error ? error.message : String(error);
        if (detailErrorMessage.toLowerCase().includes("failed to fetch")) {
            detailErrorMessage += getEnhancedLocalLlmErrorHint(endpointSettings.baseUrl, runtimeName);
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
        return `Error: For local image generation with ${runtimeName}, a model identifier must be provided (e.g., from 'Local Model File Selector' or a specific model name if your server routes it).`;
      }
      
      const cleanBaseUrl = endpointSettings.baseUrl.replace(/\/$/, '');
      const url = `${cleanBaseUrl}/images/generations`; 

      try {
        const requestBody = {
          model: localModelIdentifier, 
          prompt: prompt,
          n: 1,
          size: "512x512", 
          response_format: "b64_json",
        };
        

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const detailedError = await processLocalLlmError(response, runtimeName, url);
          throw new Error(`LOCAL_IMAGE_GEN_ERROR: ${detailedError}`);
        }
        const data = await response.json();
        if (data.data && data.data[0] && data.data[0].b64_json) {
          return `data:image/jpeg;base64,${data.data[0].b64_json}`;
        }
        throw new Error(`LOCAL_IMAGE_GEN_ERROR: ${runtimeName} image endpoint response did not contain expected image data format (data[0].b64_json). Response: ${JSON.stringify(data).substring(0,200)}`);
      } catch (error) {
        console.error(`Error in generateImage with ${runtimeName} (model: ${localModelIdentifier}):`, error);
        let detailErrorMessage = error instanceof Error ? error.message : String(error);

        if (runtimeName === "LM Studio" && detailErrorMessage.includes("Unexpected endpoint or method")) {
            detailErrorMessage += ` (Hint: LM Studio's standard server may not support the '/v1/images/generations' endpoint out-of-the-box for all loaded models, or it might require a specific image generation model to be active and correctly configured. Check your LM Studio server setup and ensure the loaded model supports image generation via this endpoint.)`;
        } else if (detailErrorMessage.toLowerCase().includes("failed to fetch")) {
            detailErrorMessage += getEnhancedLocalLlmErrorHint(endpointSettings.baseUrl, runtimeName);
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
        
        let parsedData: any;
        try {
            parsedData = JSON.parse(cleanJsonStr);
        } catch (e) {
            const parseErrorMessage = `Error parsing JSON from ${llmName} in defineNodeFromPrompt: ${e instanceof Error ? e.message : String(e)}. Raw response snippet: ${cleanJsonStr.substring(0, 500)}`;
            console.error(parseErrorMessage);
            throw new Error(parseErrorMessage);
        }
        
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
                        if (typeof input.exampleValue !== 'string' || (!String(input.exampleValue).trim().startsWith('{') && !String(input.exampleValue).trim().startsWith('['))) {
                           throw new Error("Not a valid JSON string structure");
                        }
                        JSON.parse(String(input.exampleValue)); 
                    } catch (e_json_val) { 
                        console.warn(`Fixing exampleValue for ${input.id} in ${parsedData.name}: expected valid JSON string, got '${input.exampleValue}'. Setting to '{"valid":true}'. Error: ${e_json_val instanceof Error ? e_json_val.message : String(e_json_val)}`);
                        input.exampleValue = '{"valid":true}';
                    }
                }
              }
            }
          }
          return parsedData as DynamicNodeConfig;
        } else { 
            const errorDetail = `Validated JSON from ${llmName} is missing required fields or is not structured as DynamicNodeConfig. Received: ${JSON.stringify(parsedData).substring(0,300)}`;
            console.error(`Error in defineNodeFromPrompt (${llmName}): ${errorDetail}`);
            throw new Error(errorDetail);
        }
    };

    if (currentConfig.activeRuntime === 'gemini') {
      if (!ai) { 
          const err = "Gemini client (process.env.API_KEY) not initialized for defineNodeFromPrompt.";
          console.error(err); 
          throw new Error(err);
      }
      try {
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-04-17',
          contents: systemInstruction, 
          config: { responseMimeType: "application/json" },
        });
        return parseAndValidateNodeConfig(response.text, "Gemini");
      } catch (error) { 
          let errorMessage = `Gemini Error during node definition: ${error instanceof Error ? error.message : String(error)}`;
          if (error instanceof Error && error.message && error.message.includes("Candidate was blocked due to SAFETY")) {
               errorMessage = "Node definition request was blocked by Gemini's safety filters. Please rephrase your description more neutrally.";
          }
          console.error("Error in defineNodeFromPrompt (Gemini):", error);
          throw new Error(errorMessage);
      }
    } else if (currentConfig.activeRuntime === 'local_lm_studio' || currentConfig.activeRuntime === 'local_ollama') {
        const isLmStudio = currentConfig.activeRuntime === 'local_lm_studio';
        const endpointSettings = isLmStudio ? currentConfig.localEndpoints.lm_studio : currentConfig.localEndpoints.ollama;
        const runtimeName = isLmStudio ? "LM Studio" : "Ollama";

        if (!endpointSettings.baseUrl) { 
            const err = `${runtimeName} endpoint URL not configured for defineNodeFromPrompt.`;
            console.error(err); 
            throw new Error(err);
        }
        
        const cleanBaseUrl = endpointSettings.baseUrl.replace(/\/$/, '');
        const url = `${cleanBaseUrl}/chat/completions`;

        try {
            const modelName = endpointSettings.modelName || (isLmStudio ? "local-model" : "gemma:latest");
            const requestBody: any = {
                model: modelName,
                messages: [{ role: "user", content: systemInstruction }], 
                temperature: 0.5, 
            };
            if (isLmStudio) {
                requestBody.stream = false;
                requestBody.max_tokens = -1; // Or a sufficiently large number like 4096 if -1 is problematic
            }
            // For Ollama, could specify response_format to ensure JSON if supported by the model
            // requestBody.format = "json"; // If Ollama supports this top-level for explicit JSON mode


            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
              const detailedError = await processLocalLlmError(response, runtimeName, url);
              throw new Error(`LOCAL_LLM_ERROR: ${detailedError}`);
            }
            const data = await response.json();
            const llmResponseText = data.choices?.[0]?.message?.content || "";

            if (!llmResponseText && data.error) {
                let errMessage = "Unknown error";
                if(typeof data.error === 'string') errMessage = data.error;
                else if (data.error.message && typeof data.error.message === 'string') errMessage = data.error.message;
                throw new Error(`LOCAL_LLM_ERROR: ${runtimeName} reported: ${errMessage}`);
            }
            if (!llmResponseText && !data.choices?.[0]?.message) {
                 throw new Error(`LOCAL_LLM_ERROR: Unexpected response structure from ${runtimeName}. No message content found.`);
            }
            return parseAndValidateNodeConfig(llmResponseText, runtimeName);
        } catch (error) { 
            console.error(`Error in defineNodeFromPrompt (${runtimeName} or JSON parsing):`, error);
            let detailErrorMessage = error instanceof Error ? error.message : String(error);
            if (detailErrorMessage.toLowerCase().includes("failed to fetch")) {
                detailErrorMessage += getEnhancedLocalLlmErrorHint(endpointSettings.baseUrl, runtimeName);
            }
            const finalUserErrorMessage = detailErrorMessage.startsWith("LOCAL_LLM_ERROR:") 
                ? detailErrorMessage 
                : `${runtimeName} Error during node definition: ${detailErrorMessage}`;
            throw new Error(finalUserErrorMessage);
        }
    }
    throw new Error("Unknown LLM runtime configured for defineNodeFromPrompt.");
  },

  getExecutionSuggestion: async (nodeLogicPrompt: string, inputData: Record<string, any>, errorMessageFromNode: string): Promise<string> => {
    const systemInstruction = `You are an AI debugging assistant for a visual workflow application.
A custom-defined node in the workflow failed during execution.
The node's behavior is determined by an "Execution Logic Prompt" which is sent to an LLM.
You need to analyze the provided Execution Logic Prompt, the input data the node received, and the error message it produced.
Based on this, provide a concise suggestion (1-3 sentences, max 50 words) to the user on:
1.  A possible reason for the error.
2.  How they might adjust their "Execution Logic Prompt" to fix it.
3.  Or, if the input data seems to be the issue, suggest checking the inputs.

Do not try to rewrite the entire prompt. Be brief and helpful.

Execution Logic Prompt:
\`\`\`
${nodeLogicPrompt}
\`\`\`

Input Data Received by Node:
\`\`\`json
${JSON.stringify(inputData, null, 2)}
\`\`\`

Error Message:
\`\`\`
${errorMessageFromNode}
\`\`\`

Provide your diagnostic suggestion:`;

    if (currentConfig.activeRuntime === 'gemini') {
      if (!ai) return "Gemini client (process.env.API_KEY) not initialized for getExecutionSuggestion.";
      try {
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-04-17',
          contents: systemInstruction,
        });
        return response.text;
      } catch (error) { return `Gemini Error fetching suggestion: ${error instanceof Error ? error.message : String(error)}`;}
    } else if (currentConfig.activeRuntime === 'local_lm_studio' || currentConfig.activeRuntime === 'local_ollama') {
        const isLmStudio = currentConfig.activeRuntime === 'local_lm_studio';
        const endpointSettings = isLmStudio ? currentConfig.localEndpoints.lm_studio : currentConfig.localEndpoints.ollama;
        const runtimeName = isLmStudio ? "LM Studio" : "Ollama";

        if (!endpointSettings.baseUrl) return `${runtimeName} endpoint URL not configured for getExecutionSuggestion.`;

        const cleanBaseUrl = endpointSettings.baseUrl.replace(/\/$/, ''); 
        const url = `${cleanBaseUrl}/chat/completions`;
      try {
         const modelName = endpointSettings.modelName || (isLmStudio ? "local-model" : "gemma:latest");
         const requestBody: any = {
          model: modelName,
          messages: [{ role: "user", content: systemInstruction }],
          temperature: 0.7,
        };
        if (isLmStudio) {
            requestBody.stream = false;
            requestBody.max_tokens = -1; // Or a high enough number like 1024 or 2048
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
          const detailedError = await processLocalLlmError(response, runtimeName, url);
          throw new Error(`LOCAL_LLM_ERROR: ${detailedError}`);
        }
        const data = await response.json();
        const suggestionText = data.choices?.[0]?.message?.content || "";

        if (!suggestionText && data.error) {
            let errMessage = "Unknown error";
            if(typeof data.error === 'string') errMessage = data.error;
            else if (data.error.message && typeof data.error.message === 'string') errMessage = data.error.message;
            throw new Error(`LOCAL_LLM_ERROR: ${runtimeName} reported: ${errMessage}`);
        }
        if (!suggestionText && !data.choices?.[0]?.message) {
             throw new Error(`LOCAL_LLM_ERROR: Unexpected response structure from ${runtimeName}. No suggestion content found.`);
        }
        return suggestionText || `${runtimeName} provided no suggestion.`;
      } catch (error) { 
        let detailErrorMessage = error instanceof Error ? error.message : String(error);
        if (detailErrorMessage.toLowerCase().includes("failed to fetch")) {
            detailErrorMessage += getEnhancedLocalLlmErrorHint(endpointSettings.baseUrl, runtimeName);
        }
        const finalUserErrorMessage = detailErrorMessage.startsWith("LOCAL_LLM_ERROR:") 
            ? detailErrorMessage 
            : `${runtimeName} Error fetching suggestion: ${detailErrorMessage}`;
        throw new Error(finalUserErrorMessage);
      }
    }
    throw new Error("Unknown LLM runtime configured for getExecutionSuggestion.");
  }
};