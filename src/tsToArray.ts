export type ITranscriptLine = {
  start: string;
  end: string;
  speech: string;
}

export default function parseTranscript(input: string | any): ITranscriptLine[] {
  if (typeof input === 'string' && input.startsWith('{')) {
    input = JSON.parse(input);
  }
  // If input is already parsed JSON from server
  if (typeof input === 'object') {
    return parseServerResponse(input);
  }

  // Otherwise parse VTT format
  return parseVTTFormat(input);
}

function parseServerResponse(json: any): ITranscriptLine[] {
  if (!json || !json.segments) {
    throw new Error('Invalid server response format');
  }

  return json.segments.map((segment: any) => ({
    start: formatTimestamp(segment.start),
    end: formatTimestamp(segment.end),
    speech: segment.text.trim()
  }));
}

function parseVTTFormat(vtt: string): ITranscriptLine[] {
  if (typeof vtt !== 'string') {
    throw new Error('Invalid VTT input: expected string');
  }

  // 1. separate lines by matching the format like "[00:03:04.000 --> 00:03:13.000]   XXXXXX"
  const matches = vtt.match(/\[[0-9:.]+\s-->\s[0-9:.]+\].*/g);
  if (!matches) {
    throw new Error('No valid transcript lines found in VTT format');
  }

  const lines = [...matches];

  // 2. remove the first line if it's empty
  if (lines[0].trim() === '') {
    lines.shift();
  }

  // 3. convert each line into an object
  return lines.map(line => {
    // 3a. split ts from speech
    let [timestamp, speech] = line.split(']  '); // two spaces

    // 3b. remove the open bracket of timestamp
    timestamp = timestamp.substring(1);

    // 3c. split timestamp into begin and end
    const [start, end] = timestamp.split(' --> ');
    
    // 3d. clean up speech text
    speech = speech.replace(/\n/g, '').trim();

    return { start, end, speech };
  });
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
}