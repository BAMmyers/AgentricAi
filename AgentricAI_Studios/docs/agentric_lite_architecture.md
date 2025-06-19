# AgentricAI Studios: "Lite" Architecture for Local & Offline Use

## 1. Vision for AgentricAI Lite

AgentricAI Studios aims to provide a powerful and flexible AI workflow environment, "powered by Google Technologies." To enhance user privacy, enable offline capabilities, reduce reliance on cloud service costs (for the user), and cater to users who wish to run their own models, an "AgentricAI Lite" mode is conceptualized.

This mode allows users to leverage:
*   **Local Large Language Models (LLMs):** Primarily by interfacing with local LLM servers like LM Studio, which often provide OpenAI-compatible API endpoints.
*   **Local Database Storage:** Utilizing browser-based storage (e.g., IndexedDB) for workflows, agent configurations, and cached results.

The goal is to allow seamless switching between the default online mode (using Google Gemini and cloud services) and this "Lite" local mode, with AgentricAI Studios intelligently adapting its functionality.

## 2. Core Components of "Lite" Mode

### 2.1. Local LLM Runtime

*   **Interface:** AgentricAI Studios will communicate with local LLMs that expose an OpenAI-compatible API endpoint. LM Studio is a primary example, typically running a server on `http://localhost:1234/v1`.
*   **User Configuration:** Users will be able to specify the endpoint URL for their local LLM server within AgentricAI Studios settings.
*   **Model Agnostic (to a degree):** While the API interface is standardized, the actual capabilities (reasoning, instruction following, JSON output generation) will depend on the specific model the user is running locally. AgentricAI Studios will send prompts assuming a capable instruction-following model.
*   **Service Abstraction:** The internal `llmService.ts` will abstract the calls, directing requests to either Gemini or the configured local endpoint based on the selected runtime.

### 2.2. Local Database (Conceptual)

*   **Technology:** Primarily `IndexedDB` in the browser. This allows for structured storage of:
    *   User-created workflows (nodes and edges).
    *   Custom agent definitions (`DynamicNodeConfig`).
    *   Cached results from frequently run agents or prompts.
    *   User preferences and settings specific to "Lite" mode within AgentricAI Studios.
*   **Benefits:**
    *   **Offline Access:** Users can load, view, and potentially modify existing workflows and agent definitions even when offline.
    *   **Reduced Latency:** Fetching cached data locally is much faster than network requests.
    *   **Privacy:** Data processed and stored locally remains on the user's machine by default.
*   **"Log Agent" and "DB" Juggernaut Adaptation:** In "Lite" mode, the "Log Agent" would primarily direct logs to the local IndexedDB instance, managed conceptually by a local-facing version of the "DB" Juggernaut's logic.

## 3. User Experience

*   **Runtime Switcher:** A clear UI element (e.g., dropdown in the AgentricAI Studios sidebar) will allow users to switch between "Gemini (Cloud)" and "Local LLM (LM Studio)".
*   **Endpoint Configuration:** When "Local LLM" is selected, an input field will appear for the user to enter/confirm their local server endpoint.
*   **Status Indication:** The UI should subtly indicate which runtime is currently active.
*   **Feature Availability:** Some features might be different or unavailable in "Lite" mode:
    *   **Image Generation:** Most local LLM setups don't include an equivalent to Imagen out-of-the-box via the OpenAI chat API. The "Image Generator" node might be disabled or return an informative message in "Lite" mode.
    *   **Web Search Grounding:** `requiresWebSearch: true` for agents like "The Mad Scientist" will not function if the local LLM doesn't have built-in web search capabilities. The results will be based purely on the model's internal knowledge. Nodes should gracefully handle this.
    *   **Juggernaut Agent Capabilities:** The effectiveness of complex Juggernaut agents in AgentricAI Studios will depend heavily on the quality of the local LLM. Some administrative agents might have reduced scope or rely more on cached policies in "Lite" mode.

## 4. Data Synchronization Strategy (Conceptual for Future Development)

*   **Initial State:** "Lite" mode is primarily local-first.
*   **Optional Sync:** In the future, users could be given an option to:
    *   **Export/Import:** Manually export their local AgentricAI Studios workflows/agents to a file and import them into an online account or another instance.
    *   **Selective Cloud Sync:** If a user logs into an AgentricAI Studios account (if such a feature is built), they could choose to sync specific local workflows or agent definitions to a central cloud store. This would be explicitly user-initiated.
*   **Conflict Resolution:** If data exists both locally and centrally, a clear strategy for conflict resolution would be needed (e.g., "last write wins," user chooses).

## 5. Benefits of "AgentricAI Lite"

*   **Enhanced Privacy:** Sensitive data can be processed entirely on the user's machine without being sent to external cloud APIs (beyond the local LLM server itself, which is also user-controlled).
*   **Offline Functionality:** Create, view, and modify workflows without an active internet connection (LLM processing still requires the local server to be running).
*   **Cost Control:** No API token costs when using a local LLM.
*   **Customization:** Users can experiment with various local models tailored to their specific needs.
*   **Reduced External Dependencies:** Less reliance on the availability and terms of third-party cloud services.

## 6. Limitations and Considerations

*   **User Setup:** Requires users to install and manage their own local LLM server (e.g., LM Studio) and download models.
*   **Model Capabilities:** The quality and features of the user's chosen local LLM will significantly impact the platform's effectiveness. Not all local models are as capable as leading cloud models like Gemini.
*   **Resource Intensive:** Running LLMs locally can be demanding on the user's CPU/GPU and RAM.
*   **Feature Parity:** Achieving full feature parity with the online Gemini-powered version might be challenging, especially for specialized services like advanced image generation or web search.
*   **Security of Local Endpoint:** Users are responsible for the security of their local LLM server endpoint if they expose it on their network.

## 7. Integration with AgentricAI Studios Platform

*   **LLM Service Abstraction (`llmService.ts`):** This is the core technical change, allowing AgentricAI Studios to route LLM requests based on the selected runtime.
*   **Conditional UI Rendering:** Some UI elements or node functionalities may need to be conditionally rendered or behave differently based on the active runtime.
*   **Error Handling:** Robust error handling to manage issues with connecting to the local LLM server or if the local model fails to process a request correctly.
*   **Documentation:** Clear instructions for users on how to set up and use "Lite" mode with LM Studio or other compatible local servers.

By thoughtfully implementing "AgentricAI Lite," AgentricAI Studios can cater to a broader range of user needs and preferences, reinforcing its commitment to innovation, security, and user empowerment.