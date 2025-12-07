from flask import Flask
from flask_socketio import SocketIO
import subprocess
from threading import Event, Lock
from dotenv import load_dotenv
from google import genai
import re
import os
from google.genai import types

load_dotenv()

WHISPER_BINARY = os.getenv("WHISPER_BINARY")
WHISPER_MODEL = os.getenv("WHISPER_MODEL")
WHISPER_LANG = os.getenv("WHISPER_LANG", "auto")

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

thread = None
clientAI = genai.Client()
thread_lock = Lock()
buffer_lock = Lock()
stop_event = Event()
context_buffer = []
process = None
ansi_escape = re.compile(r"(\x9B|\x1B\[)[0-?]*[ -/]*[@-~]")

IGNORE_PATTERNS = [
    "Sous-titrage Société Radio-Canada",
    "Sous-titrage",
]


def analyze_with_ai_stream(text):
    """Stream AI response in real-time"""
    try:
        prompt = (
            """You are an AI assistant that answers questions based on the transcription below.

Instructions:
1. Provide clear, concise, human like answers in the same language as the question.
2. Answer in a direct, conversational way, with no bullet points or lists.
3. If there are multiple questions, start answering from the most recent one and go backwards.
4. Do not add any introduction or meta comments, just answer the questions themselves.

Transcription:
"""
            + text
        )

        for chunk in clientAI.models.generate_content_stream(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
            ),
        ):
            if chunk.text:
                socketio.emit("ai_response_chunk", {"text": chunk.text})
                socketio.sleep(0)

        # Signal completion
        socketio.emit("ai_response_complete", {})
        socketio.sleep(0)

    except Exception as e:
        print(f"AI Error: {e}")
        socketio.emit("ai_error", {"error": str(e)})


def process_ai_response():
    """Process AI response in background with streaming"""
    socketio.emit("ai_thinking", {"status": "processing"})

    with buffer_lock:
        full_context = " ".join(context_buffer)

    if not full_context.strip():
        socketio.emit(
            "ai_response_chunk",
            {"text": "No transcription available yet. Please start speaking first."},
        )
        socketio.emit("ai_response_complete", {})
        return

    analyze_with_ai_stream(full_context)


def stream_transcription():
    global process
    cmd = [
        WHISPER_BINARY,
        "-m",
        WHISPER_MODEL,
        "-l",
        WHISPER_LANG,
        "-t",
        "8",
        "--step",
        "2000",
        "--length",
        "8000",
    ]
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        bufsize=1,
        universal_newlines=True,
    )

    last_sent_text = ""

    try:
        for line in process.stdout:
            if not stop_event.is_set():
                break
            text = ansi_escape.sub("", line).strip()
            if any(pattern in text for pattern in IGNORE_PATTERNS):
                continue
            if text:
                if text == last_sent_text:
                    continue
                if last_sent_text and text.startswith(last_sent_text):
                    text = text[len(last_sent_text) :]
                with buffer_lock:
                    context_buffer.append(text)
                    if len(context_buffer) > 20:
                        context_buffer.pop(0)
                last_sent_text = text
                socketio.emit("transcription", {"text": text})
                print(f"Sent: {text}", flush=True)
    finally:
        if process:
            process.terminate()
            process.wait()
            process = None


@socketio.on("connect")
def handle_connect():
    print("Client connected")


@socketio.on("start_transcription")
def start():
    global thread
    with thread_lock:
        if thread is None:
            stop_event.set()
            thread = socketio.start_background_task(stream_transcription)


@socketio.on("ask_ai")
def ask_ai():
    """Manual trigger for AI analysis"""
    print("AI analysis requested manually")
    socketio.start_background_task(process_ai_response)


@socketio.on("stop_transcription")
def stop():
    global thread, process
    stop_event.clear()
    if process:
        process.terminate()
    with thread_lock:
        if thread is not None:
            thread.join(timeout=2)
            thread = None
    print("Process Terminated")


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5050, debug=False)
