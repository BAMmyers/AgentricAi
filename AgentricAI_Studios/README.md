

# AgentricAI Studios: An Overview

**AgentricAI Studios: powered by Google Technologies**

AgentricAI Studios is a dynamic, web-based visual environment designed for creating, experimenting with, and executing sophisticated AI agents and complex workflows. It empowers users to intuitively build and manage AI-driven processes through a node-based interface.

## Core Capabilities

*   **Visual Workflow Construction:**
    *   **Node-Based Interface:** Drag and drop "Juggernaut" agents (nodes) onto an interactive canvas.
    *   **Edge Connections:** Visually connect nodes to define data flow and execution order.
    *   **Canvas Navigation:** Supports smooth panning, zooming, and node resizing for managing complex workflows.
    *   **Floating Search Menu:** Quickly find and add agents to the canvas via a double-click activated search interface with an index view.

*   **Intelligent Agent System ("Juggernauts"):**
    *   **Pre-defined Agents:** A rich library of agents for various tasks, including text input, LLM prompting, image generation, data display, and specialized AI utilities.
    *   **Dynamic Node Definition:** Users can define new custom agents by describing their functionality, inputs, outputs, and execution logic in natural language. The system leverages an LLM to generate the new node configuration.
    *   **"The Apprentice":** An AI assistant agent capable of understanding user instructions to help plan and describe workflows using other AgentricAI tools.
    *   **"AgentricAI" (Master Agent):** A conceptual orchestrator for handling complex, multi-step user requests.

*   **Powerful LLM Integration:**
    *   **Google Gemini:** Utilizes `gemini-2.5-flash-preview-04-17` for advanced text generation, agent logic, and dynamic node creation.
    *   **Google Imagen:** Employs `imagen-3.0-generate-002` for AI-powered image generation.
    *   **Local LLM Support:** Flexible configuration to connect with local LLM providers like Ollama and LM Studio (via OpenAI-compatible API endpoints).
    *   **Configurable Settings:** UI to switch between LLM runtimes and manage endpoint details.

*   **Workflow Execution & Management:**
    *   **Automatic Downstream Execution:** Changes in a node's output data automatically trigger connected downstream nodes.
    *   **Manual Node Execution:** Individual nodes can be executed on demand.
    *   **Queued Workflow Execution:** A "Run Full Workflow" button executes all nodes on the canvas sequentially based on their order of addition.
    *   **Autosave & Recovery:** The current workflow (nodes and edges) is automatically saved to your browser's local storage. This "short-term memory" ensures that if you close or refresh the tab, your latest canvas state is reloaded, allowing you to resume your session.
    *   **Visual Feedback:**
        *   Nodes display their status (idle, running, success, error) and execution time.
        *   Errors are clearly displayed on the respective node.
        *   The currently executing node is highlighted with a vibrant border.
    *   **Node Management:** Easily remove nodes with a close button or resize them with a drag handle.

*   **User Experience & Design:**
    *   **Interactive Nodes:** Nodes can feature internal UI elements like text areas, input fields, and image displays.
    *   **Data Type System:** Ports and edges are color-coded based on their data type (text, image, number, JSON, any) for enhanced visual clarity.
    *   **Themed Interface:** A sleek, dark "stealth bomber" theme with black/gunmetal grey components and "rivet" border details for a cohesive and modern look.

## Technology Stack

*   **Frontend:** React, TypeScript, Tailwind CSS, Vite
*   **Core AI:** Google GenAI SDK for Gemini and Imagen models.
*   **Local LLM Interface:** Standard HTTP requests to OpenAI-compatible API endpoints.
*   **Persistence:** Browser `localStorage` for autosaving the current workflow.

## Key Agent Highlights

*   **Text Input:** Basic data entry.
*   **Gemini Prompt / Image Generator:** Direct access to Google's powerful generative models.
*   **The Apprentice:** AI assistant for workflow planning.
*   **Universal Data Adapter:** AI-powered node for transforming data between incompatible types.
*   **Display Nodes:** For visualizing text, images, or raw data.
*   **Numerous Utility Agents:** Summarizers, translators, code helpers, creative writers, and more, defined as "Juggernaut" agents.
*   **Conceptual Python & Git Agents:** For planning and scripting Python code and Git version control operations using LLM-driven simulation.

## Getting Started

1.  **Prerequisites:**
    *   Ensure you have [Node.js](https://nodejs.org/) (which includes npm) installed. Version 18.x or higher is recommended.
    *   A modern web browser (Chrome, Firefox, Edge).
    *   (Optional) [GitHub CLI](https://cli.github.com/) for `gh repo clone` command.

2.  **Clone the Repository:**
    ```bash
    # Using GitHub CLI (recommended)
    gh repo clone BAMmyers/AgentricAi.git
    
    # Or using HTTPS
    # git clone https://github.com/BAMmyers/AgentricAi.git
    
    # Or using SSH
    # git clone git@github.com:BAMmyers/AgentricAi.git
    
    cd AgentricAi.git
    ```

3.  **Install Dependencies:**
    Navigate to the project directory in your terminal and run:
    ```bash
    npm install
    ```
    (This installs React, Vite, and other necessary packages defined in `package.json`)

4.  **API Key (for Google Gemini & Imagen):**
    *   For cloud AI features (Gemini, Imagen), an API key for Google Gemini is required.
    *   Create a file named `.env` in the root of the project (alongside `package.json`).
    *   Add your API key to this file:
        ```env
        API_KEY=YOUR_GEMINI_API_KEY_HERE
        ```
    *   `process.env.API_KEY` will then be available to the application when run via Vite.

5.  **Local LLMs (Optional):**
    Users can configure AgentricAI Studios to use local LLMs (Ollama, LM Studio) via the in-app settings panel (gear icon) after starting the application. Ensure your local LLM server is running and accessible.

## Installation and Running Options

AgentricAI Studios can be run in several ways:

### 1. Development Mode (Recommended for Contribution & Customization)

This mode uses Vite's development server, which provides hot module reloading and is ideal for making changes to the code.

*   **Using Utility Scripts:**
    *   **Windows:** Double-click `start-dev-server.bat` or run it from your command prompt.
    *   **macOS/Linux:** First, make the script executable: `chmod +x start-dev-server.sh`.Then run: `./start-dev-server.sh`.
*   **Manual Command:**
    ```bash
    npm run dev
    ```
Vite will typically start the server on `http://localhost:5173` (it will display the exact URL in the terminal). Open this URL in your web browser.

**Important:** You must use the Vite development server for development. Opening the `index.html` file directly in your browser (e.g., `file:///.../index.html`) will not work and will likely result in errors like "Unexpected token '<'".

### 2. Production Build (For Deployment as a Web App)

This creates an optimized, static build of the application in the `dist` folder. These files can be deployed to any static web hosting service (e.g., Netlify, Vercel, GitHub Pages, or your own server).

*   **Using Utility Scripts:**
    *   **Windows:** Run `build-production.bat`.
    *   **macOS/Linux:** Make executable (`chmod +x build-production.sh`) and run `./build-production.sh`.
*   **Manual Command:**
    ```bash
    npm run build
    ```
The output will be in the `dist` folder.

### 3. Serving Production Build Locally

After building the application, you can serve the `dist` folder locally to test the production build.

*   **Using Utility Scripts:**
    *   **Windows:** Run `serve-production-build.bat`.
    *   **macOS/Linux:** Make executable (`chmod +x serve-production-build.sh`) and run `./serve-production-build.sh`.
    These scripts use `npx serve`. If `serve` is not installed globally (`npm install -g serve`), `npx` will download and run it temporarily.
*   **Manual Command (Example using `serve`):**
    ```bash
    npx serve dist
    ```
    This will typically serve the application on `http://localhost:3000`.

### 4. Future: Native Application & Browser Extension

*   **Native Desktop Application:** Packaging AgentricAI Studios as a standalone desktop application (e.g., using Electron, Tauri, or PWA features) is a potential future development path to enhance multi-platform support and offline capabilities. This is not yet implemented.
*   **Browser Extension:** Similarly, creating a browser extension version would require a different architecture and is a consideration for future expansion.

The application will automatically save your work in progress to browser `localStorage` when run in a browser environment.

## Vision

AgentricAI Studios aims to provide an intuitive, flexible, and powerful platform for AI experimentation, workflow automation, and the development of sophisticated agentic systems, leveraging cutting-edge AI technologies from Google and the broader ecosystem. It strives for multi-model, multi-platform, and multi-OS usability to empower a diverse range of users.