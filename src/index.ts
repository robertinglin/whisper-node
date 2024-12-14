import path from 'path'
import shell, { shellExec, initializeWhisperCpp, IShellOptions } from './shell';
import { createCppCommand, IFlagTypes } from './whisper';
import transcriptToArray, { ITranscriptLine } from './tsToArray';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import { ChildProcess } from 'child_process';

interface IOptions {
  modelName?: string,
  modelPath?: string,
  whisperOptions?: IFlagTypes,
  shellOptions?: IShellOptions,
  serverUrl?: string
}

interface IServerState {
  isRunning: boolean;
  process: ChildProcess | null;
  port: number;
  modelName?: string;
  modelPath?: string;
}

let serverState: IServerState = {
  isRunning: false,
  process: null,
  port: 8080
};

// Handle process termination
function setupCleanupHandlers() {
  const cleanup = async () => {
    await whisperCleanup();
    process.exit(0);
  };

  // Handle various termination signals
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGHUP', cleanup);
  
  // Handle Windows-specific signals
  if (process.platform === 'win32') {
    process.on('SIGBREAK', cleanup);
  }
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (err) => {
    console.error('[whisper-node-server] Uncaught exception:', err);
    await cleanup();
  });
}

export async function whisperInit(options?: IOptions): Promise<void> {
  if (serverState.isRunning) {
    console.log("[whisper-node-server] Server already running on port", serverState.port);
    return;
  }

  try {
    // Ensure whisper.cpp is built
    await initializeWhisperCpp();

    const command = createCppCommand({
      modelName: options?.modelName,
      modelPath: options?.modelPath,
      options: options?.whisperOptions,
      isServer: true
    });

    console.log("[whisper-node-server] Starting server with command:", command);
    serverState.process = shell(command, options?.shellOptions);
    serverState.modelName = options?.modelName;
    serverState.modelPath = options?.modelPath;
    
    // Set up process event handlers
    if (serverState.process) {
      serverState.process.on('error', (error) => {
        console.error("[whisper-node-server] Server process error:", error);
        serverState.isRunning = false;
      });

      serverState.process.on('exit', (code, signal) => {
        console.log("[whisper-node-server] Server process exited with code:", code, "signal:", signal);
        serverState.isRunning = false;
        serverState.process = null;
      });
    }
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    serverState.isRunning = true;
    
    // Set up cleanup handlers
    setupCleanupHandlers();
    
    console.log("[whisper-node-server] Server started successfully on port", serverState.port);
  } catch (error) {
    console.error("[whisper-node-server] Failed to start server:", error);
    throw error;
  }
}

export async function whisperCleanup(): Promise<void> {
  if (!serverState.process) {
    return;
  }

  console.log("[whisper-node-server] Shutting down server...");
  
  try {
    // Try graceful shutdown first
    serverState.process.kill('SIGTERM');
    
    // Wait for process to exit gracefully
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (serverState.process) {
          console.log("[whisper-node-server] Force killing server process...");
          try {
            serverState.process.kill('SIGKILL');
          } catch (e) {
            console.error("[whisper-node-server] Error during force kill:", e);
          }
        }
        resolve();
      }, 5000); // Wait 5 seconds for graceful shutdown

      serverState.process!.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      serverState.process!.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  } catch (error) {
    console.error("[whisper-node-server] Error during server shutdown:", error);
  } finally {
    serverState.process = null;
    serverState.isRunning = false;
    console.log("[whisper-node-server] Server shutdown complete");
  }
}

// returns array[]: {start, end, speech}
export const whisper = async (filePath: string, options?: IOptions): Promise<ITranscriptLine[]> => {
  try {
    console.log("[whisper-node-server] Transcribing:", filePath, "\n");

    if (serverState.isRunning) {
      const serverUrl = options?.serverUrl || `http://localhost:${serverState.port}/inference`;
      const form = new FormData();
      
      // Add the audio file
      form.append('file', fs.createReadStream(filePath));
      
      // Add parameters as regular form fields
      form.append('response_format', 'verbose_json');
      
      // Add optional whisper parameters if provided
      if (options?.whisperOptions) {
        Object.entries(options.whisperOptions).forEach(([key, value]) => {
          // Convert boolean values to lowercase strings as expected by the server
          const formValue = typeof value === 'boolean' ? String(value).toLowerCase() : String(value);
          form.append(key, formValue);
        });
      }
      
      console.log('Sending request with options:', {
        response_format: 'verbose_json',
        ...options?.whisperOptions
      });
      
      const response = await fetch(serverUrl, {
        method: 'POST',
        body: form
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error('Server response:', text);
        throw new Error(`Server error: ${response.statusText}`);
      }
      
      const result = await response.json();
      return transcriptToArray(result);
    } else {
      // Fall back to one-off command if server isn't running
      const command = createCppCommand({
        filePath: path.normalize(`"${filePath}"`),
        modelName: options?.modelName,
        modelPath: options?.modelPath ? `"${options?.modelPath}"` : undefined,
        options: options?.whisperOptions
      });

      const transcript = await shellExec(command, options?.shellOptions);
      return transcriptToArray(transcript);
    }
  } catch (error) {
    console.error("[whisper-node-server] Error:", error);
    throw error;
  }
};

export default whisper;
