#! /usr/bin/env node

// Javascript layer for using the whisper.cpp built-in model downloader scripts 
//
// npx whisper-node-server download

import shell from 'shelljs';

import readlineSync from 'readline-sync';

import {DEFAULT_MODEL, NODE_MODULES_MODELS_PATH} from './constants'

const MODELS_LIST = [
  "tiny",
  "tiny.en",
  "base",
  "base.en",
  "small",
  "small.en",
  "medium",
  "medium.en",
  "large-v1",
  "large",
  "large-v3-turbo"
];


const askModel = async () => {
  const answer = await readlineSync.question(`\n[whisper-node-server] Enter model name (e.g. 'base.en') or 'cancel' to exit\n(ENTER for base.en): `)

  if (answer === "cancel") {
    console.log("[whisper-node-server] Exiting model downloader. Run again with: 'npx whisper-node-server download'");
    process.exit(0);
  }
  // user presses enter
  else if (answer === "") {
    console.log("[whisper-node-server] Going with", DEFAULT_MODEL);
    return DEFAULT_MODEL;
  }
  else if (!MODELS_LIST.includes(answer)) {
    console.log("\n[whisper-node-server] FAIL: Name not found. Check your spelling OR quit wizard and use custom model.");

    // re-ask question
    return await askModel();
  }

  return answer;
}



export default async function downloadModel() {
  try {
    // shell.exec("echo $PWD");
    shell.cd(NODE_MODULES_MODELS_PATH);

    console.log(`
| Model     | Disk   | RAM     |
|-----------|--------|---------|
| tiny      |  75 MB | ~390 MB |
| tiny.en   |  75 MB | ~390 MB |
| base      | 142 MB | ~500 MB |
| base.en   | 142 MB | ~500 MB |
| small     | 466 MB | ~1.0 GB |
| small.en  | 466 MB | ~1.0 GB |
| medium    | 1.5 GB | ~2.6 GB |
| medium.en | 1.5 GB | ~2.6 GB |
| large-v1  | 2.9 GB | ~4.7 GB |
| large     | 2.9 GB | ~4.7 GB |
| large-v3-turbo | ??? | ??? |
`);

    // ensure running in correct path
    if (!shell.which("./download-ggml-model.sh")) {
      throw "whisper-node-server downloader is not being run from the correct path! cd to project root and run again."
    }

    const modelName = await askModel();

    // default is .sh
    let scriptPath = "./download-ggml-model.sh"
    // windows .cmd version
    if(process.platform === 'win32') scriptPath = "download-ggml-model.cmd";

    shell.exec(`${scriptPath} ${modelName}`);

    // TODO: add check in case download-ggml-model doesn't return a successful download.
    // to prevent continuing to compile; that makes it harder for user to see which script failed.

    console.log("[whisper-node-server] Attempting to compile model...");

    // move up directory, run make in whisper.cpp
    shell.cd("../")
    // this has to run in whichever directory the model is located in??
    shell.exec("make clean");
    shell.exec("make -j", {
      env: {
        ...process.env,
        GGML_CUDA: '1',
        CUDA_PATH: 'C:/PROGRA~1/NVIDIA~1/CUDA/v12.6',
        CUDA_DOCKER_ARCH: 'compute_86',
        GGML_CUDA_FORCE_MMQ: '1',
        VERBOSE: '1'
      }
    });

    process.exit(0);
  } catch (error) {
    console.log("ERROR Caught in downloadModel")
    console.log(error);
    return error;
  }
}

// runs after being called in package.json
downloadModel();
