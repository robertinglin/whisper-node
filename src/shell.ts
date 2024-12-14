import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import shelljs from 'shelljs';
import fs from 'fs';

// docs: https://github.com/ggerganov/whisper.cpp

export interface IShellOptions {
  cwd?: string;
  silent?: boolean;
}

function findWhisperCppDir(): string {
  // Check if running from node_modules
  const nodeModulesPath = path.join(process.cwd(), 'node_modules', 'whisper-node-server', 'lib', 'whisper.cpp');

  const releaseBin = path.join(nodeModulesPath, 'build', 'bin', 'Release');
  if (fs.existsSync(releaseBin)) {
    return releaseBin;
  }

  if (fs.existsSync(nodeModulesPath)) {
    return nodeModulesPath;
  }

  // Check if running from development directory
  const devPath = path.join(__dirname, '..', 'lib', 'whisper.cpp');
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  throw new Error('Could not find whisper.cpp directory');
}

const defaultOptions: IShellOptions = {
  cwd: findWhisperCppDir(),
  silent: false
};

// For commands that need output returned
export function shellExec(command: string, options: IShellOptions = {}): Promise<string> {
  const mergedOptions = { ...defaultOptions, ...options };
  
  return new Promise((resolve, reject) => {
    const result = shelljs.exec(command, { 
      silent: mergedOptions.silent,
      cwd: mergedOptions.cwd,
      async: false
    });

    if (result.code === 0) {
      resolve(result.stdout);
    } else {
      reject(new Error(result.stderr));
    }
  });
}

// For long-running processes that need to be managed
export default function shell(command: string, options: IShellOptions = {}): ChildProcess {
  const mergedOptions = { ...defaultOptions, ...options };
  const [cmd, ...args] = command.split(' ').filter(Boolean);
  
  // Ensure we use the full path to the executable
  const cmdPath = path.join(mergedOptions.cwd, cmd);
  
  if (!mergedOptions.silent) {
    console.log('[whisper-node-server] Executing:', cmdPath, args.join(' '));
    console.log('[whisper-node-server] Working directory:', mergedOptions.cwd);
  }

  const childProcess = spawn(cmdPath, args, {
    cwd: mergedOptions.cwd,
    stdio: mergedOptions.silent ? 'ignore' : 'inherit',
    windowsHide: false
  });

  childProcess.on('error', (error) => {
    console.error('[whisper-node-server] Process error:', error);
  });

  if (!mergedOptions.silent) {
    childProcess.on('exit', (code) => {
      if (code === 0) {
        console.log('[whisper-node-server] Process completed successfully');
      } else {
        console.error(`[whisper-node-server] Process exited with code ${code}`);
      }
    });
  }

  return childProcess;
}

// Initialize whisper.cpp build if needed
export async function initializeWhisperCpp(): Promise<void> {
  try {
    const whisperDir = findWhisperCppDir();
    shelljs.cd(whisperDir);
    
    if (!shelljs.which('make')) {
      throw new Error("make command not found. Please install build tools.");
    }

    const serverExe = path.join(whisperDir, 'server.exe');
    if (!fs.existsSync(serverExe)) {
      console.log("[whisper-node-server] Whisper.cpp server not built. Running make...");
      
      const result = shelljs.exec('make', { silent: false });
      if (result.code !== 0) {
        throw new Error("Failed to build whisper.cpp");
      }
      
      if (!fs.existsSync(serverExe)) {
        throw new Error("Build completed but server.exe not found");
      }
      
      console.log("[whisper-node-server] Successfully built whisper.cpp");
    }
  } catch (error) {
    console.error("[whisper-node-server] Error initializing whisper.cpp:", error);
    throw error;
  }
}