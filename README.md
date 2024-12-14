# whisper-node-server

[![npm downloads](https://img.shields.io/npm/dm/whisper-node-server)](https://npmjs.org/package/whisper-node-server)
[![npm downloads](https://img.shields.io/npm/l/whisper-node-server)](https://npmjs.org/package/whisper-node-server)  

Node.js bindings for OpenAI's Whisper. Transcription done local.

## Features

- Output transcripts to **JSON** (also .txt .srt .vtt)
- **Optimized for CPU** (Including Apple Silicon ARM)
- Timestamp precision to single word
- Server mode with automatic audio conversion
- Optional CUDA support for GPU acceleration

## Installation

1. Add dependency to project

```text
npm install whisper-node-server
```

2. Download whisper model of choice [OPTIONAL]

```text
npx whisper-node-server download
```

[Requirement for Windows: Install the ```make``` command from here.](https://gnuwin32.sourceforge.net/packages/make.htm)

## Usage

### Direct Usage

```javascript
import whisper from 'whisper-node-server';

const transcript = await whisper("example/sample.wav");

console.log(transcript); // output: [ {start,end,speech} ]
```

### Server Mode

1. Set up environment variables:
```env
WHISPER_MODEL=base.en
AUDIO_SAMPLE_RATE=16000
AUDIO_CHANNELS=1
```

2. Create the server:
```javascript
import express from 'express';
import multer from 'multer';
import whisper from 'whisper-node-server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const app = express();
const upload = multer({ dest: 'uploads/' });
const execPromise = promisify(exec);

// Transcribe endpoint
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No audio file uploaded');
    }

    const inputPath = req.file.path;
    const outputPath = inputPath.replace(/\.wav$/, '_converted.wav');

    // Convert audio to configured sample rate using FFmpeg
    await execPromise(`ffmpeg -y -i "${inputPath}" -ar ${process.env.AUDIO_SAMPLE_RATE} -ac ${process.env.AUDIO_CHANNELS} -c:a pcm_s16le "${outputPath}"`);

    // Transcribe the audio
    const options = {
      modelName: process.env.WHISPER_MODEL,
      whisperOptions: {
        language: 'auto',
        word_timestamps: true
      }
    };

    const transcript = await whisper(outputPath, options);

    // Clean up temp files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    // Extract speech text
    const text = transcript ? (Array.isArray(transcript) ? 
      transcript.map(t => t.speech).join(' ') : 
      transcript.toString()) : '';
      
    res.json({ text });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).send('Error processing audio: ' + error.message);
  }
});

app.listen(8080, () => {
  console.log('Server running on port 8080');
});
```

3. Send audio for transcription:
```javascript
// Convert your audio to a blob
const wavBlob = await float32ArrayToWav(audio);
const formData = new FormData();
formData.append('audio', wavBlob, 'recording.wav');

// Send to server
const response = await fetch('http://localhost:8080/transcribe', {
  method: 'POST',
  body: formData,
});

if (!response.ok) {
  throw new Error('Transcription failed');
}

const data = await response.json();
console.log('Transcription:', data.text);
```

### Output (JSON)

```javascript
[
  {
    "start":  "00:00:14.310", // time stamp begin
    "end":    "00:00:16.480", // time stamp end
    "speech": "howdy"         // transcription
  }
]
```

### Full Options List

```javascript
import whisper from 'whisper-node-server';

const filePath = "example/sample.wav"; // required

const options = {
  modelName: "base.en",       // default
  // modelPath: "/custom/path/to/model.bin", // use model in a custom directory (cannot use along with 'modelName')
  whisperOptions: {
    language: 'auto'          // default (use 'auto' for auto detect)
    gen_file_txt: false,      // outputs .txt file
    gen_file_subtitle: false, // outputs .srt file
    gen_file_vtt: false,      // outputs .vtt file
    word_timestamps: true     // timestamp for every word
    // timestamp_size: 0      // cannot use along with word_timestamps:true
  }
}

const transcript = await whisper(filePath, options);
```

### Input File Format

Files must be .wav and 16Hz

Example .mp3 file converted with an [FFmpeg](https://ffmpeg.org) command: ```ffmpeg -i input.mp3 -ar 16000 output.wav```

## Made with

- [Whisper OpenAI (using C++ port by: ggerganov)](https://github.com/ggerganov/whisper.cpp)
- [ShellJS](https://www.npmjs.com/package/shelljs)

## Roadmap

- [x] Support projects not using Typescript
- [x] Allow custom directory for storing models
- [ ] Config files as alternative to model download cli
- [ ] Remove *path*, *shelljs* and *prompt-sync* package for browser, react-native expo, and webassembly compatibility
- [ ] [fluent-ffmpeg](https://www.npmjs.com/package/fluent-ffmpeg) to automatically convert to 16Hz .wav files as well as support separating audio from video
- [ ] [Pyanote diarization](https://huggingface.co/pyannote/speaker-diarization) for speaker names
- [ ] [Implement WhisperX as optional alternative model](https://github.com/m-bain/whisperX) for diarization and higher precision timestamps (as alternative to C++ version)
- [ ] Add option for viewing detected langauge as described in [Issue 16](https://github.com/ariym/whisper-node-server/issues/16)
- [ ] Include typescript types in ```d.ts``` file
- [x] Add support for language option
- [ ] Add support for transcribing audio streams as already implemented in whisper.cpp

## Modifying whisper-node-server

```npm run dev``` - runs nodemon and tsc on '/src/test.ts'

```npm run build``` - runs tsc, outputs to '/dist' and gives sh permission to 'dist/download.js'

## Acknowledgements

- [Georgi Gerganov](https://ggerganov.com/)
- [Ari](https://aricv.com)
