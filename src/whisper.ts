// todo: remove all imports from file
import { existsSync } from 'fs';
import path from 'path';
import { DEFAULT_MODEL } from './constants';

// return as syntax for whisper.cpp command
export const createCppCommand = ({ filePath, modelName = null, modelPath = null, options = null, isServer = false, port = 8080 }: CppCommandTypes) => {
  const flags = getFlags(options);
  const model = modelPathOrName(modelName, modelPath);
  const exeExt = process.platform === 'win32' ? '.exe' : '';
  
  if (isServer) {
    return `server${exeExt} ${flags} -m ${model} --host 0.0.0.0 --port ${port}`;
  } else {
    return `main${exeExt} ${flags} -m ${model} -f ${filePath}`;
  }
};

const modelPathOrName = (mn: string | null, mp: string | null): string => {
  if (mn && mp) throw "Submit a modelName OR a modelPath. NOT BOTH!"
  
  // Use default model if none specified
  if (!mn && !mp) {
    console.log("[whisper-node-server] No 'modelName' or 'modelPath' provided. Using default model:", DEFAULT_MODEL,"\n");
    const modelPath = path.join('models', MODELS_LIST[DEFAULT_MODEL]);
    
    if (!existsSync(modelPath)) {
      throw `'${DEFAULT_MODEL}' not downloaded! Run 'npx whisper-node-server download'`;
    }
    
    return modelPath;
  }
  
  // Use custom model path
  if (mp) return mp;
  
  // Use model from models directory
  if (mn && MODELS_LIST[mn]) {
    const modelPath = path.join('models', MODELS_LIST[mn]);
    
    if (!existsSync(modelPath)) {
      throw `'${mn}' not found! Run 'npx whisper-node-server download'`;
    }
    
    return modelPath;
  }
  
  if (mn) throw `modelName "${mn}" not found in list of models. Check your spelling OR use a custom modelPath.`;
  throw `modelName OR modelPath required! You submitted modelName: '${mn}', modelPath: '${mp}'`;
}

// option flags list: https://github.com/ggerganov/whisper.cpp/blob/master/README.md?plain=1#L91
const getFlags = (flags: IFlagTypes | null): string => {
  if (!flags) return '';
  
  const flagList = [];
  
  // Language
  if (flags.language) {
    flagList.push(`-l ${flags.language}`);
  }
  
  // Word timestamps
  if (flags.word_timestamps) {
    flagList.push('-ml 1');
  }
  
  // Timestamp size
  if (flags.timestamp_size) {
    flagList.push(`-ts ${flags.timestamp_size}`);
  }
  
  // Output files
  if (flags.gen_file_txt) flagList.push('-otxt');
  if (flags.gen_file_subtitle) flagList.push('-osrt');
  if (flags.gen_file_vtt) flagList.push('-ovtt');
  
  return flagList.join(' ');
};

// model list: https://github.com/ggerganov/whisper.cpp/#more-audio-samples
export const MODELS_LIST = {
  "tiny": "ggml-tiny.bin",
  "tiny.en": "ggml-tiny.en.bin",
  "base": "ggml-base.bin",
  "base.en": "ggml-base.en.bin",
  "small": "ggml-small.bin",
  "small.en": "ggml-small.en.bin",
  "medium": "ggml-medium.bin",
  "medium.en": "ggml-medium.en.bin",
  "large-v1": "ggml-large-v1.bin",
  "large": "ggml-large.bin",
  "large-v3-turbo": "ggml-large-v3-turbo.bin",
}

export interface CppCommandTypes {
  filePath?: string;
  modelName?: string | null;
  modelPath?: string | null;
  options?: IFlagTypes | null;
  isServer?: boolean;
  port?: number;
}

export interface IFlagTypes {
  "gen_file_txt"?: boolean;
  "gen_file_subtitle"?: boolean;
  "gen_file_vtt"?: boolean;
  "timestamp_size"?: number;
  "word_timestamps"?: boolean;
  "language"?: string;
}