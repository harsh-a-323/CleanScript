import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import ytdl from '@distube/ytdl-core';
import { v4 as uuidv4 } from 'uuid';

// Types for better structure
interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface CleanedSegment {
  start: number;
  end: number;
  originalText?: string;
  cleanedText?: string;
}

// Step 1: Download audio from YouTube (Memory-based, no file system)
async function downloadAudioToBuffer(youtubeUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = ytdl(youtubeUrl, { 
      filter: 'audioonly', 
      quality: 'highestaudio',
      // Add these options for better compatibility
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    });

    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on('end', () => {
      const audioBuffer = Buffer.concat(chunks);
      console.log(`Audio buffer size: ${audioBuffer.length} bytes`);
      resolve(audioBuffer);
    });

    stream.on('error', (error) => {
      console.error('Stream error:', error);
      reject(error);
    });

    // Add timeout to prevent hanging
    setTimeout(() => {
      stream.destroy();
      reject(new Error('Audio download timeout after 90 seconds'));
    }, 90000);
  });
}

// Step 2: Send audio buffer to Deepgram API
async function transcribeWithDeepgram(audioBuffer: Buffer): Promise<any> {
  try {
    console.log('Sending audio to Deepgram...');
    const response = await axios.post(
      'https://api.deepgram.com/v1/listen',
      audioBuffer,
      {
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/mp3',
        },
        params: {
          filler_words: true,
          smart_format: true,
          punctuate: true,
          utterances: true,
          utt_split: 5,
          words: true
        },
        timeout: 120000, // 2 minutes timeout
        maxContentLength: 100 * 1024 * 1024, // 100MB max
        maxBodyLength: 100 * 1024 * 1024
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Deepgram API error:', error.response?.data || error.message);
    throw new Error(`Deepgram transcription failed: ${error.response?.data?.message || error.message}`);
  }
}

// Step 3: Clean transcript using Gemini AI
async function cleanTranscriptWithGemini(segments: TranscriptSegment[]): Promise<CleanedSegment[]> {
  try {
    // Prepare the data for Gemini
    const transcriptData = {
      segments: segments.map((seg, index) => ({
        id: index + 1,
        start: seg.start,
        end: seg.end,
        text: seg.text
      }))
    };

    const prompt = `
You are a highly skilled and meticulous transcript cleaner. You will be provided with a JSON array of transcript segments, each with timestamps. Your ABSOLUTE TOP PRIORITY is to clean each segment to perfection, ensuring the final transcript is highly readable and error-free.

**MANDATORY RULES - YOU MUST FOLLOW THESE EXACTLY:**

1.  **ELIMINATE ALL FILLER WORDS:** Completely remove words like "um", "uh", "ah", "er", "like", "you know", "so", "well", "actually", "basically", "literally", "right", "okay", "alright," and any similar words or phrases that do not contribute to the meaning of the sentence.
2.  **CORRECT ALL MISSPELLED WORDS:** Identify and correct any spelling errors. Use your extensive vocabulary to ensure all words are spelled correctly.
3.  **ENSURE MEANINGFUL AND ACCURATE TRANSCRIPT:** The cleaned transcript MUST be perfectly understandable and accurately reflect the original speech. Do not remove any information that is essential to the meaning. If a phrase is unclear, use your knowledge of language to infer the correct meaning and rewrite it for clarity.
4.  **REMOVE REPETITIVE WORDS:** Eliminate any unnecessary repetition of words or phrases (e.g., "I I think" should become "I think" or "you can you can you can" must become "you can").
5.  **MAINTAIN NATURAL FLOW:** Ensure the cleaned text flows naturally and reads smoothly even from the previous segment.
6.  **KEEP THE SAME JSON STRUCTURE:** The output MUST be a JSON array with the exact same structure as the input, including timestamps.
7.  **DO NOT CHANGE TECHNICAL TERMS OR PROPER NOUNS:** Preserve technical terms and proper nouns accurately.
8.  **PRESERVE SPEAKER'S INTENT AND STYLE:** While cleaning, retain the speaker's original intent and style of speaking.

INPUT JSON:
${JSON.stringify(transcriptData, null, 2)}

Please return ONLY a clean JSON array with this exact structure:
[
  {
    "id": 1,
    "start": timestamp,
    "end": timestamp,
    "originalText": "original text with fillers",
    "cleanedText": "cleaned text without fillers"
  }
]

Return only the JSON array, no additional text or explanation.`;

    console.log("Sending request to Gemini...");

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 1,
          maxOutputTokens: 8192,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 80000 // 1 minute timeout
      }
    );

    const geminiResponse = response.data.candidates[0].content.parts[0].text;

    // Extract JSON from the response (in case there's additional text)
    const jsonMatch = geminiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Gemini response');
    }

    const cleanedSegments = JSON.parse(jsonMatch[0]);

    return cleanedSegments.map((segment: any) => ({
      start: segment.start,
      end: segment.end,
      cleanedText: segment.cleanedText
    }));

  } catch (error: any) {
    console.error('Error cleaning transcript with Gemini:', error.response?.data || error.message);

    // Fallback: return original segments as cleaned (no processing)
    return segments.map(seg => ({
      start: seg.start,
      end: seg.end,
      cleanedText: seg.text,
    }));
  }
}

// Step 4: Alternative - Simple local cleaning (backup method)
function simpleCleanTranscript(segments: TranscriptSegment[]): CleanedSegment[] {
  const fillerWords = [
    'um', 'uh', 'ah', 'er', 'like', 'you know', 'so', 'well', 
    'actually', 'basically', 'literally', 'right', 'okay', 'alright',
    'kind of', 'sort of', 'i mean', 'you see', 'let me see'
  ];

  return segments.map(segment => {
    let cleanedText = segment.text.toLowerCase();
    
    // Remove filler words
    fillerWords.forEach(filler => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      cleanedText = cleanedText.replace(regex, '');
    });
    
    // Clean up extra spaces and punctuation
    cleanedText = cleanedText
      .replace(/\s+/g, ' ')  // Multiple spaces to single space
      .replace(/\s+([,.!?])/g, '$1')  // Remove space before punctuation
      .trim();
    
    // Capitalize first letter
    cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
    
    return {
      start: segment.start,
      end: segment.end,
      originalText: segment.text,
      cleanedText: cleanedText
    };
  });
}

// Main processing function (No file system usage)
async function processYouTubeTranscript(youtubeUrl: string) {
  const requestId = uuidv4().slice(0, 8);
  console.log(`[${requestId}] Starting transcript processing for: ${youtubeUrl}`);

  try {
    console.log(`[${requestId}] Downloading audio to memory...`);
    const audioBuffer = await downloadAudioToBuffer(youtubeUrl);
    
    if (audioBuffer.length === 0) {
      throw new Error('Downloaded audio buffer is empty');
    }

    console.log(`[${requestId}] Audio downloaded successfully, size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB`);

    console.log(`[${requestId}] Transcribing with Deepgram...`);
    const transcriptionResult = await transcribeWithDeepgram(audioBuffer);

    // Safety check for utterances
    if (!transcriptionResult.results.utterances || transcriptionResult.results.utterances.length === 0) {
      throw new Error('No utterances detected in the transcript.');
    }

    // Segments with timestamps
    const segments: TranscriptSegment[] = transcriptionResult.results.utterances.map((utterance: any) => ({
      start: utterance.start,
      end: utterance.end,
      text: utterance.transcript
    }));

    console.log(`[${requestId}] Found ${segments.length} transcript segments`);
    console.log(`[${requestId}] Cleaning transcript with Gemini AI...`);
    
    // Try Gemini cleaning first, fallback to simple cleaning if it fails
    let cleanedSegments: CleanedSegment[];
    try {
      cleanedSegments = await cleanTranscriptWithGemini(segments);
    } catch (error) {
      console.log(`[${requestId}] Gemini cleaning failed, using simple cleaning...`);
      cleanedSegments = simpleCleanTranscript(segments);
    }

    console.log(`[${requestId}] Transcript processing completed successfully`);

    return {
      success: true,
      data: {
        videoUrl: youtubeUrl,
        cleanedSegments: cleanedSegments,
        totalDuration: segments.length > 0 ? segments[segments.length - 1].end : 0,
        segmentCount: segments.length,
        audioSize: `${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB`
      }
    };

  } catch (err: any) {
    console.error(`[${requestId}] Error:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
      requestId
    };
  }
}

// GET endpoint handler
export async function GET(request: NextRequest) {
  try {
    // Get YouTube URL from query parameters
    const { searchParams } = new URL(request.url);
    const youtubeUrl = searchParams.get('url');

    // Validate YouTube URL
    if (!youtubeUrl) {
      return NextResponse.json(
        { success: false, error: 'YouTube URL is required. Use ?url=<youtube_url>' },
        { status: 400 }
      );
    }

    // Validate that it's a YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+/;
    if (!youtubeRegex.test(youtubeUrl)) {
      return NextResponse.json(
        { success: false, error: 'Invalid YouTube URL format' },
        { status: 400 }
      );
    }

    // Check for required environment variables
    if (!process.env.DEEPGRAM_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'DEEPGRAM_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    console.log('Processing request for:', youtubeUrl);

    // Process the YouTube transcript
    const result = await processYouTubeTranscript(youtubeUrl);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 500 });
    }

  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Configure the API route
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max execution time