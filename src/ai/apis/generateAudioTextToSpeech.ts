// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node

import { GoogleGenAI } from "@google/genai";
import mime from "mime";
import { writeFile } from "fs";

function saveBinaryFile(fileName: string, content: Buffer) {
  writeFile(fileName, content, "utf8", (err) => {
    if (err) {
      console.error(`Error writing file ${fileName}:`, err);
      return;
    }
    console.log(`File ${fileName} saved to file system.`);
  });
}

export async function generateAudioTTS(text: string) {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const config = {
    temperature: 1,
    responseModalities: ["audio"],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: "Zephyr",
        },
      },
    },
  };
  const model = "gemini-2.5-pro-preview-tts";
  const contents = [
    {
      role: "narrator",
      //   role: "user",
      parts: [
        {
          text: text ?? `INSERT_INPUT_HERE`,
        },
      ],
    },
  ];

  const response = await ai.models.generateContent({
    model,
    config,
    contents,
  });
  if (
    !response ||
    !response.candidates ||
    !response.candidates[0]?.content ||
    !response.candidates[0].content.parts ||
    !response.candidates[0].content.parts[0]?.inlineData
  )
    throw Error();

  const inlineData = response.candidates?.[0].content.parts?.[0]?.inlineData;
  let fileExtension = mime.getExtension(inlineData.mimeType || "");
  let buffer = Buffer.from(inlineData.data || "", "base64");
  if (!fileExtension) {
    fileExtension = "wav";
    buffer = convertToWav(inlineData.data || "", inlineData.mimeType || "");
  }
  const fileName = `audio_${Math.random()}`;
  saveBinaryFile(`${fileName}.${fileExtension}`, buffer);
  return response;
  //   let fileIndex = 0;
  //   for await (const chunk of response) {
  //     if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
  //       continue;
  //     }
  //     if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
  //       const fileName = `ENTER_FILE_NAME_${fileIndex++}`;
  //       const inlineData = chunk.candidates[0].content.parts[0].inlineData;
  //       let fileExtension = mime.getExtension(inlineData.mimeType || '');
  //       let buffer = Buffer.from(inlineData.data || '', 'base64');
  //       if (!fileExtension) {
  //         fileExtension = 'wav';
  //         buffer = convertToWav(inlineData.data || '', inlineData.mimeType || '');
  //       }
  //       saveBinaryFile(`${fileName}.${fileExtension}`, buffer);
  //     }
  //     else {
  //       console.log(chunk.text);
  //     }
  //   }
}

interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

function convertToWav(rawData: string, mimeType: string) {
  const options = parseMimeType(mimeType);
  const wavHeader = createWavHeader(rawData.length, options);
  const buffer = Buffer.from(rawData, "base64");

  return Buffer.concat([wavHeader, buffer]);
}

function parseMimeType(mimeType: string) {
  const [fileType, ...params] = mimeType.split(";").map((s) => s.trim());
  const [, format] = fileType!.split("/");

  const options: Partial<WavConversionOptions> = {
    numChannels: 1,
  };

  if (format && format.startsWith("L")) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) {
      options.bitsPerSample = bits;
    }
  }

  for (const param of params) {
    const [key, value] = param.split("=").map((s) => s.trim());
    if (key === "rate") {
      options.sampleRate = parseInt(value!, 10);
    }
  }

  return options as WavConversionOptions;
}

function createWavHeader(dataLength: number, options: WavConversionOptions) {
  const { numChannels, sampleRate, bitsPerSample } = options;

  // http://soundfile.sapp.org/doc/WaveFormat

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = Buffer.alloc(44);

  buffer.write("RIFF", 0); // ChunkID
  buffer.writeUInt32LE(36 + dataLength, 4); // ChunkSize
  buffer.write("WAVE", 8); // Format
  buffer.write("fmt ", 12); // Subchunk1ID
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(byteRate, 28); // ByteRate
  buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
  buffer.write("data", 36); // Subchunk2ID
  buffer.writeUInt32LE(dataLength, 40); // Subchunk2Size

  return buffer;
}
