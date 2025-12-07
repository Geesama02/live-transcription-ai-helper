# live-transcription-ai-helper

Real‑time speech‑to‑text and AI answering assistant using `whisper.cpp`, Flask‑SocketIO, React, and Gemini.

## UI Preview



## What It Does

- Streams audio into `whisper.cpp` and shows live transcription in the browser.
- Cleans Whisper output (ANSI codes, tiny/noisy chunks, repeated refinements).
- On **Answer** button:
  - Sends recent transcript to Gemini.
  - Detects questions in the conversation.
  - Answers them in a natural, interview‑style way in the same language.
  - Can also handle normal technical questions, not just meeting talk.

## Tech Stack

- **Backend:** Python, Flask, Flask‑SocketIO (threading async mode), `whisper.cpp` subprocess, Gemini via `google-genai`.
- **Frontend:** React + Tailwind CSS, `socket.io-client`, with two main panels:
  - Left: transcription (Start/Stop, Clear, auto‑scroll).
  - Right: AI answers (Answer, Clear, auto‑scroll).

## Prerequisites

Before running this project you must have:

- **whisper.cpp** compiled locally, with the `whisper-stream` binary available on disk.
- A downloaded Whisper model file (e.g. `ggml-large-v3-turbo.bin`).
- Python 3.10+ and Node.js 18+ installed.

## Config & Environment

The backend reads paths and keys from environment variables (via a `.env` file):
```
GEMINI_API_KEY=your-gemini-api-key-here
WHISPER_BINARY=/home/you/whisper.cpp/build/bin/whisper-stream
WHISPER_MODEL=/home/you/whisper.cpp/models/ggml-large-v3-turbo.bin
WHISPER_LANG=fr # or en, or auto for auto detection
```

These values are injected into the `subprocess.Popen` command so the binary, model, and language are configurable without changing code.

## Running Locally

### Backend
```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py # serves Socket.IO on http://localhost:5050
```

### Frontend
```
cd client/app/
npm install
npm run dev # opens in http://localhost:5000
```
