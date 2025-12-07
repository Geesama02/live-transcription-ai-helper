import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5050";

function Home() {
  const [connected, setConnected] = useState(false);
  const [lines, setLines] = useState([]);
  const [AiLines, setAiLines] = useState([]);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [currentStreamingResponse, setCurrentStreamingResponse] = useState("");
  const socketRef = useRef(null);
  const currentStreamingRef = useRef(null);
  const transcriptRef = useRef(null);
  const aiRef = useRef(null);

  // Auto-scroll transcription panel when lines change
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [lines]);

  // Auto-scroll AI panel when AiLines change or streaming
  useEffect(() => {
    if (aiRef.current) {
      aiRef.current.scrollTop = aiRef.current.scrollHeight;
    }
  }, [AiLines, currentStreamingResponse]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("transcription", (data) => {
      const text = data.text || "";
      if (!text.trim()) return;
      setLines((prev) => {
        const next = [...prev, { text, ts: new Date().toLocaleTimeString() }];
        return next.slice(-200);
      });
    });

    socket.on("ai_thinking", () => {
      setThinking(true);
      currentStreamingRef.current = "";
      setCurrentStreamingResponse("");
    });

    socket.on("ai_response_chunk", (data) => {
      setThinking(false);
      currentStreamingRef.current += data.text;
      setCurrentStreamingResponse((prev) => prev + data.text);
    });

    socket.on("ai_response_complete", () => {
      setThinking(false);
      const full = currentStreamingRef.current.trim();
      if (!full) return;

      setAiLines((prev) => [
        ...prev,
        {
          text: full,
          question: "Question",
          ts: new Date().toLocaleTimeString(),
        },
      ]);

      currentStreamingRef.current = "";
      setCurrentStreamingResponse("");
    });

    socket.on("ai_error", (data) => {
      setThinking(false);
      setAiLines((prev) => [
        ...prev,
        {
          text: `Error: ${data.error}`,
          question: "Error",
          ts: new Date().toLocaleTimeString(),
        },
      ]);
      currentStreamingRef.current = "";
      setCurrentStreamingResponse("");
    });

    return () => {
      socket.disconnect();
    };
  }, []); // 👈 run once

  const handleStart = () => {
    if (socketRef.current) {
      setListening(true);
      socketRef.current.emit("start_transcription");
    }
  };

  const handleStop = () => {
    if (socketRef.current) {
      setListening(false);
      socketRef.current.emit("stop_transcription");
    }
  };

  const handleAi = () => {
    if (socketRef.current && !thinking) {
      socketRef.current.emit("ask_ai");
    }
  };

  const handleClearTrans = () => {
    setLines([]);
  };

  const handleClearAi = () => {
    setAiLines([]);
    setCurrentStreamingResponse("");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 flex justify-center items-center p-4 font-sans">
      <div className="w-full flex gap-5 bg-slate-950 rounded-xl p-6 shadow-2xl border border-gray-800">
        {/* Transcription Panel */}
        <div className="w-full">
          <h1 className="text-2xl font-semibold mb-2.5">
            🎙 Real‑Time Transcription
          </h1>

          <div className="text-sm mb-3 text-gray-400">
            Status:{" "}
            <span className={connected ? "text-green-500" : "text-red-500"}>
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>

          <div className="flex gap-2 mb-3">
            {!listening ? (
              <button
                className="px-4 py-2 rounded-lg border-none bg-green-500 text-slate-950 font-semibold cursor-pointer hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={handleStart}
                disabled={!connected}
              >
                Start Listening
              </button>
            ) : (
              <button
                className="px-4 py-2 rounded-lg border-none bg-red-500 text-white font-semibold cursor-pointer hover:bg-red-600 transition-colors"
                onClick={handleStop}
              >
                Stop Listening
              </button>
            )}
            <button
              className="px-4 py-2 rounded-lg border border-gray-600 bg-transparent text-gray-200 font-medium cursor-pointer hover:bg-gray-800 transition-colors"
              onClick={handleClearTrans}
            >
              Clear
            </button>
          </div>

          <div
            className="mt-2 bg-slate-950 rounded-lg border border-gray-800 p-3 h-[420px] overflow-y-auto text-sm scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
            ref={transcriptRef}
          >
            {lines.map((line, idx) => (
              <div key={idx} className="mb-1.5 flex gap-2">
                <span className="text-gray-500 tabular-nums min-w-[72px]">
                  {line.ts}
                </span>
                <span className="text-gray-200">{line.text}</span>
              </div>
            ))}
            {lines.length === 0 && (
              <div className="text-gray-500 text-center mt-10">
                Press "Start Listening" and begin speaking in your meeting…
              </div>
            )}
          </div>
        </div>

        {/* AI Panel */}
        <div className="w-full bg-slate-950">
          <h1 className="text-2xl font-semibold mb-2.5">🤖 AI Agent</h1>

          <div className="text-sm mb-3 text-gray-400">
            Status:{" "}
            <span className={!thinking ? "text-green-500" : "text-yellow-400"}>
              {thinking ? "Thinking..." : "Ready"}
            </span>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              className="px-4 py-2 rounded-lg border-none bg-green-500 text-slate-950 font-semibold cursor-pointer hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={handleAi}
              disabled={thinking}
            >
              Answer
            </button>
            <button
              className="px-4 py-2 rounded-lg border border-gray-600 bg-transparent text-gray-200 font-medium cursor-pointer hover:bg-gray-800 transition-colors"
              onClick={handleClearAi}
            >
              Clear
            </button>
          </div>

          <div
            className="mt-2 bg-slate-950 rounded-lg border flex flex-col gap-2 border-gray-800 p-3 h-[420px] overflow-y-auto text-sm scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
            ref={aiRef}
          >
            {/* Previous completed responses */}
            {AiLines.map((line, idx) => (
              <div
                key={idx}
                className="flex gap-3 flex-col border rounded-xl border-blue-300"
              >
                <div className="p-3 bg-blue-400 rounded-xl">
                  <h1 className="font-bold text-slate-900">{line.question}</h1>
                </div>
                <div className="mb-1.5 flex gap-2 p-3">
                  <span className="text-gray-200 font-semibold">
                    {line.text}
                  </span>
                </div>
              </div>
            ))}

            {/* Current streaming response */}
            {currentStreamingResponse && (
              <div className="flex gap-3 flex-col border rounded-xl border-green-300 animate-pulse">
                <div className="p-3 bg-green-400 rounded-xl">
                  <h1 className="font-bold text-slate-900">Streaming...</h1>
                </div>
                <div className="mb-1.5 flex gap-2 p-3">
                  <span className="text-gray-200 font-semibold whitespace-pre-wrap">
                    {currentStreamingResponse}
                    <span className="inline-block w-1 h-4 bg-green-400 ml-1 animate-blink"></span>
                  </span>
                </div>
              </div>
            )}

            {AiLines.length === 0 && !currentStreamingResponse && (
              <div className="text-gray-500 text-center mt-10">
                Click "Answer" to get AI analysis of the transcription…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
