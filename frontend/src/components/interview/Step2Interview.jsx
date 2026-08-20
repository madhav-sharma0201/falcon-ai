import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FiArrowRight, FiClock, FiMessageSquare,
  FiMic, FiMicOff, FiCamera, FiCameraOff, FiCode,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import Timer from "./Timer";
import maleVideo   from "../../assets/male-ai.mp4";
import femaleVideo from "../../assets/female-ai.mp4";
import CodeEditorPanel from "./CodeEditorPanel";
import { submitAnswer } from "../../api/interview.api";

// ── Interviewer persona ─────────────────────────────────────────────
// Change INTERVIEWER_GENDER to switch who conducts the interview. Video,
// speech pitch and voice selection all follow from that one value.
const PERSONAS = {
  // Keep pitch at 1.0 for an already-male voice. Artificially deepening a
  // compact system voice makes it sound more synthetic, not more natural.
  male:   { video: maleVideo,   rate: 0.95, pitch: 1.0 },
  female: { video: femaleVideo, rate: 0.92, pitch: 1.05 },
};

const INTERVIEWER_GENDER = "male";
const INTERVIEWER = { gender: INTERVIEWER_GENDER, ...PERSONAS[INTERVIEWER_GENDER] };

// Known voices per gender, best first. en-IN names lead because the users are
// Indian candidates and an Indian-accented interviewer feels closer to the
// real thing. Note the female list is always tested first when looking for a
// male voice: a bare /male/ pattern also matches the word "female", which is
// exactly how a voice named "Microsoft Heera" could end up as the interviewer.
const VOICE_NAMES = {
  female: [
    /\bheera\b/i, /\bveena\b/i,          // en-IN
    /\bsamantha\b/i, /\bzira\b/i, /\bava\b/i, /\ballison\b/i,
    /\bhazel\b/i, /\bsusan\b/i, /\bcatherine\b/i, /\bfiona\b/i,
    /\bmoira\b/i, /\btessa\b/i, /\bkaren\b/i, /\bvictoria\b/i, /\bserena\b/i,
    /google uk english female/i, /google us english female/i,
    /\bfemale\b/i,
  ],
  male: [
    /\brishi\b/i, /\bravi\b/i, /\bprabhat\b/i,   // en-IN
    /\bdaniel\b/i, /\boliver\b/i, /\bgeorge\b/i, // en-GB
    /\balex\b/i, /\bdavid\b/i, /\bmark\b/i,      // en-US
    /\bguy\b/i, /\baaron\b/i, /\bfred\b/i, /\bthomas\b/i,
    /google uk english male/i, /google us english male/i,
    /\bmale\b/i,
  ],
};

// Score a voice for how well it fits the persona. Negative = disqualified.
const scoreVoice = (v, gender) => {
  const name = v.name || "";
  const lang = v.lang || "";
  const wanted = VOICE_NAMES[gender];
  const other  = VOICE_NAMES[gender === "male" ? "female" : "male"];

  // Rule out the opposite gender before anything else.
  if (other.some((re) => re.test(name))) return -1;

  // Disqualify non-English outright. macOS ships the same first name under
  // many locales ("Daniel (French (France))"), and a French voice reading an
  // English question is worse than any accent mismatch.
  if (!/^en/i.test(lang)) return -1;

  const rank = wanted.findIndex((re) => re.test(name));
  if (rank === -1) return -1; // unrecognised voice — don't guess

  let score = (wanted.length - rank) * 10;
  if (/^en[-_]?IN/i.test(lang)) score += 25;
  else if (/^en[-_]?(GB|US|AU)/i.test(lang)) score += 12;
  else score += 6;

  return score;
};

const pickInterviewerVoice = (voices, gender = INTERVIEWER.gender) => {
  const ranked = voices
    .map((v) => ({ v, s: scoreVoice(v, gender) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (ranked.length) return ranked[0].v;
  // Nothing matched on this device — fall back to any English voice. The
  // persona's pitch still shifts it in the right direction.
  return voices.find((v) => /^en/i.test(v.lang || "")) || voices[0] || null;
};

function Step2Interview({ interviewData, user }) {
  const navigate = useNavigate();

  // ── State ──
  const [question, setQuestion]         = useState(interviewData.question);
  const [currentIndex, setCurrentIndex] = useState(interviewData.currentQuestion || 0);
  const [answer, setAnswer]             = useState("");
  const [feedback, setFeedback]         = useState(null);
  const [loading, setLoading]           = useState(false);
  const [timeLeft, setTimeLeft]         = useState(interviewData.question.timer || 60);
  const [timerActive, setTimerActive]   = useState(true); // paused once the answer is submitted

  // UI toggles
  const [micOn, setMicOn]       = useState(true); // user's manual preference — only changed by the mic button
  const [micError, setMicError] = useState("");   // surfaced to the user; blank when voice input is healthy
  const [codeOpen, setCodeOpen] = useState(false);

  // Camera is proctored: it is meant to stay on for the whole interview, so
  // there is no user-facing off switch — only a retry when it drops.
  const [cameraOn, setCameraOn]       = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [warnings, setWarnings]       = useState([]); // proctoring events, newest last

  // Speech
  const [isAIPlaying, setIsAIPlaying]     = useState(false);
  const [subtitle, setSubtitle]           = useState("");
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [introSpoken, setIntroSpoken]     = useState(false);
  const [interim, setInterim]             = useState(""); // live, uncommitted speech

  // Refs
  const aiVideoRef    = useRef(null);
  const userVideoRef  = useRef(null);
  const recognitionRef = useRef(null);
  const streamRef      = useRef(null);

  // Mirrors of state for use inside recognition/speech callbacks, which are
  // registered once and would otherwise read stale values.
  const micOnRef       = useRef(true);
  const aiPlayingRef   = useRef(false);
  const recRunningRef  = useRef(false); // guards start()/stop() against InvalidStateError

  const videoSource  = INTERVIEWER.video;
  const userName     = user?.name || "there";

  // Aptitude questions arrive with four options and are answered by picking
  // one. Everything else stays free-text.
  const isMCQ = Array.isArray(question?.options) && question.options.length > 0;
  const progress     = ((currentIndex + 1) / interviewData.totalQuestions) * 100;

  // Mic is only ever turned on/off by the button (micOn). While the AI is
  // speaking we still pause the underlying recognition engine so it doesn't
  // pick up the AI's own voice, but that's just visual/technical — the
  // button's actual on/off state never changes on its own.
  const micVisualOn = micOn && !isAIPlaying;

  // ── Load voices ──
  // getVoices() is empty on first call in Chrome until the engine warms up,
  // so this runs again on voiceschanged.
  useEffect(() => {
    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      setSelectedVoice(pickInterviewerVoice(voices));
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ── Speech recognition ──
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMicError("Voice input isn't supported in this browser. Use Chrome or Edge, or type your answer below.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN"; // Indian English acoustic model; falls back to en-US upstream
    rec.continuous = true;
    rec.interimResults = true; // drives the live "hearing you" preview
    rec.maxAlternatives = 1;

    // Walk every result from resultIndex forward. Reading only the last
    // result (the previous behaviour) silently dropped words whenever Chrome
    // finalised more than one segment in a single event — which is exactly
    // what happens when someone speaks a long, fluent answer.
    rec.onresult = (e) => {
      let committed = "";
      let pending   = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) committed += result[0].transcript;
        else                pending   += result[0].transcript;
      }

      if (committed.trim()) {
        setAnswer((prev) => {
          const sep = prev && !/\s$/.test(prev) ? " " : "";
          return prev + sep + committed.trim();
        });
      }
      setInterim(pending.trim());
    };

    // start() reports permission/device failures here, asynchronously — a
    // try/catch around start() never sees them.
    rec.onerror = (e) => {
      if (e.error === "no-speech") return; // harmless; onend restarts the session
      recRunningRef.current = false;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicError("Microphone is blocked. Allow mic access for this site in your browser settings, then switch the mic back on.");
      } else if (e.error === "audio-capture") {
        setMicError("No microphone found. Connect one, or type your answer below.");
      } else if (e.error === "network") {
        setMicError("Voice input needs an internet connection (speech is transcribed by the browser's service).");
      } else {
        setMicError(`Voice input error: ${e.error}`);
      }
      micOnRef.current = false;
      setMicOn(false);
    };

    // Chrome ends the session on its own after silence, even with
    // continuous = true. Restart it so the mic doesn't go quietly deaf.
    rec.onend = () => {
      recRunningRef.current = false;
      if (micOnRef.current && !aiPlayingRef.current) startMic();
    };

    recognitionRef.current = rec;

    return () => {
      micOnRef.current = false;
      rec.onend = null;
      try { rec.stop(); } catch { /* already stopped */ }
    };
  }, []);

  const startMic = () => {
    if (!recognitionRef.current || recRunningRef.current) return;
    try {
      recognitionRef.current.start();
      recRunningRef.current = true;
    } catch {
      recRunningRef.current = false;
    }
  };

  const stopMic = () => {
    if (!recognitionRef.current) return;
    recRunningRef.current = false;
    setInterim(""); // nothing is being heard once the engine is stopped
    try { recognitionRef.current.stop(); } catch { /* already stopped */ }
  };

  // Only place that changes the user's mic preference — the button.
  const toggleMic = () => {
    const next = !micOn;
    micOnRef.current = next;
    setMicOn(next);
    if (next) {
      setMicError("");
      startMic();
    } else {
      stopMic();
    }
  };

  // ── Camera (proctored: expected on for the whole interview) ──

  // Keep at most the last 20 events so a long interview can't grow unbounded.
  const addWarning = useCallback((text) => {
    setWarnings((prev) => [
      ...prev.slice(-19),
      { text, at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) },
    ]);
  }, []);

  const startCamera = useCallback(async (isRetry = false) => {
    if (streamRef.current?.getVideoTracks().some((t) => t.readyState === "live")) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      streamRef.current = stream;

      // Fires when the camera is stopped outside the app — the browser's own
      // "stop sharing" control, a disconnected webcam, or the OS reclaiming it.
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          setCameraOn(false);
          setCameraError("Your camera was turned off. It must stay on for the whole interview.");
          addWarning("Camera turned off");
        };
      });

      setCameraOn(true);
      setCameraError("");
      if (isRetry) addWarning("Camera restored");
    } catch (err) {
      setCameraOn(false);
      const denied = err?.name === "NotAllowedError" || err?.name === "SecurityError";
      const missing = err?.name === "NotFoundError" || err?.name === "OverconstrainedError";
      setCameraError(
        denied
          ? "Camera access is blocked. Allow it for this site in your browser settings — the interview is proctored and needs it on."
          : missing
          ? "No camera found. Connect a webcam to continue the interview."
          : "Camera is unavailable. It may be in use by another app (Zoom, Meet, Photo Booth)."
      );
    }
  }, [addWarning]);

  // Acquire on mount. This is the "subscribe to an external system" case the
  // rule exempts — getUserMedia is async, so no state is set synchronously here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startCamera();
  }, [startCamera]);

  // Bind the stream once the <video> element is actually mounted. Doing this
  // in an effect (rather than a setTimeout after getUserMedia) means the
  // preview survives re-renders and reconnects on every retry.
  useEffect(() => {
    if (cameraOn && userVideoRef.current && streamRef.current) {
      userVideoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOn]);

  // Keep trying to get it back while it is off, so the candidate doesn't have
  // to notice a banner and click anything.
  useEffect(() => {
    if (cameraOn) return;
    const id = setInterval(() => startCamera(true), 5000);
    return () => clearInterval(id);
  }, [cameraOn, startCamera]);

  // ── Proctoring: leaving the interview tab ──
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) addWarning("Switched away from the interview tab");
    };
    window.addEventListener("visibilitychange", onVisibility);
    return () => window.removeEventListener("visibilitychange", onVisibility);
  }, [addWarning]);

  // ── Speak ──
  const speakText = (text) =>
    new Promise((resolve) => {
      if (!window.speechSynthesis || !selectedVoice || !text?.trim()) { resolve(); return; }

      // Cancel anything currently speaking first.
      window.speechSynthesis.cancel();

      // Chrome has a known race condition where calling speak() right after
      // cancel() causes the new utterance's onend to fire instantly without
      // actually speaking. A tiny delay avoids that.
      setTimeout(() => {
        const utter = new SpeechSynthesisUtterance(
          text.replace(/,/g, ", ... ").replace(/\./g, ". ... ")
        );
        utter.voice  = selectedVoice;
        utter.rate   = INTERVIEWER.rate;
        utter.pitch  = INTERVIEWER.pitch;
        utter.volume = 1;
        utter.onstart = () => {
          setIsAIPlaying(true);
          // Pause recognition only while AI is actually speaking, so it
          // doesn't capture the AI's own voice. This doesn't change micOn.
          aiPlayingRef.current = true;
          stopMic();
          aiVideoRef.current?.play();
        };
        utter.onend = () => {
          aiVideoRef.current?.pause();
          if (aiVideoRef.current) aiVideoRef.current.currentTime = 0;
          setIsAIPlaying(false);
          aiPlayingRef.current = false;
          // Resume listening only if the user's mic preference is still on.
          if (micOnRef.current) startMic();
          setTimeout(() => { setSubtitle(""); resolve(); }, 300);
        };
        setSubtitle(text);
        window.speechSynthesis.speak(utter);
      }, 150);
    });

  // ── Welcome + First Question on voice load ──
  useEffect(() => {
    if (!selectedVoice || introSpoken) return;
    const runIntro = async () => {
      setIntroSpoken(true);
      // Small pause after everything loads before the AI starts talking.
      await new Promise((r) => setTimeout(r, 1200));
      await speakText(`Welcome ${userName.split(" ")[0]}! Let's begin your interview.`);
      await new Promise((r) => setTimeout(r, 900));
      await speakText(interviewData.question.question);
    };
    runIntro();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVoice]);

  // ── Speak question when it changes (not first load) ──
  useEffect(() => {
    if (!introSpoken || !selectedVoice) return;
    const speak = async () => {
      await new Promise((r) => setTimeout(r, 900));
      await speakText(question.question);
    };
    speak();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  // ── Sync interviewData ──
  useEffect(() => {
    setQuestion(interviewData.question);
    setCurrentIndex(interviewData.currentQuestion);
    setTimeLeft(interviewData.question.timer || 60);
  }, [interviewData]);

  // ── Timer reset on question change ──
  useEffect(() => {
    setTimeLeft(question.timer || 60);
    setTimerActive(true);
  }, [question]);

  // ── Timer countdown ──
  useEffect(() => {
    if (timeLeft <= 0 || !timerActive) return;
    const t = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, timerActive]);

  // ── Auto-submit when timer hits 0 ──
  useEffect(() => {
    if (timeLeft !== 0) return;
    const autoSubmit = async () => {
      await speakText("Time is up. Submitting your answer now.");
      const finalAnswer = answer.trim() || "No answer provided. Time over.";

        setLoading(true);
        const res = await submitAnswer({ interviewId: interviewData.interviewId, answer: finalAnswer });
          
        if (res.completed) {
          setFeedback(res.feedback);
          await new Promise((r) => setTimeout(r, 700));
          await speakText(
            res.feedback?.feedback ||
            "Great job! Your interview is complete. Preparing your report now."
          );
          setLoading(false);
          navigate(`/interview/${interviewData.interviewId}/report`);
          return;
        }

        setFeedback(res.feedback);
        await new Promise((r) => setTimeout(r, 700));
        await speakText(
          res.feedback?.feedback ||
          "Noted your answer. Let's move to the next question."
        );

        setLoading(false);
        setQuestion(res.question);
        setCurrentIndex(res.currentQuestion);
        setAnswer("");
        setFeedback(null);
      
    };
    autoSubmit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // ── Submit ──
  const submit = async () => {
    if (!answer.trim()) return;
   
      setTimerActive(false); // stop the countdown as soon as the answer is submitted
      setLoading(true);
      const res = await submitAnswer({ interviewId: interviewData.interviewId, answer })
       
      if (res.completed) {
        setFeedback(res.feedback);
        await new Promise((r) => setTimeout(r, 700));
        await speakText(
          res.feedback?.feedback ||
          "Great job! Your interview is complete. Preparing your report now."
        );
        setLoading(false);
        navigate(`/interview/${interviewData.interviewId}/report`);
        return;
      }

      setFeedback(res.feedback);
      await new Promise((r) => setTimeout(r, 700));
      await speakText(
        res.feedback?.feedback ||
        "Noted your answer. Let's move to the next question."
      );
      setLoading(false);
      setQuestion(res.question);
      setCurrentIndex(res.currentQuestion);
      setAnswer("");
      setFeedback(null);
    
  };

  // ── Code editor → append to answer ──
  const handleCodeSubmit = (code) => {
    setAnswer((prev) => {
      const separator = prev.trim() ? "\n\n--- Code ---\n" : "--- Code ---\n";
      return prev + separator + code;
    });
    setCodeOpen(false);
  };

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis.cancel();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-3 sm:p-5">

      {/* Code Editor Popup */}
      <CodeEditorPanel
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
        onSubmitCode={handleCodeSubmit}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-5xl bg-[#0E1016] border border-white/10 rounded-2xl sm:rounded-[24px] overflow-hidden shadow-[0_0_60px_rgba(255,255,255,.03)] grid lg:grid-cols-[36%_64%]"
      >

        {/* ── LEFT: AI Video + User Camera + Controls ── */}
        <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-white/8 p-4 sm:p-5 gap-3">

          {/* AI Video */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video
              ref={aiVideoRef}
              src={videoSource}
              muted
              playsInline
              preload="auto"
              loop
              className="w-full h-full object-cover"
            />
            {isAIPlaying && (
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                <div className="flex gap-0.5 items-end h-3">
                  {[1,2,3].map(i => (
                    <motion.div
                      key={i}
                      className="w-0.5 bg-white rounded-full"
                      animate={{ height: ["4px","12px","4px"] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-white/80">AI Speaking</span>
              </div>
            )}
          </div>

          {/* Reserved Subtitle Space */}
          <div className="min-h-[52px] flex items-center">
            <AnimatePresence>
              {subtitle && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="w-full rounded-xl bg-white/5 border border-white/8 px-3 py-2"
                >
                  <p className="text-xs text-white/65 leading-relaxed text-center">{subtitle}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Camera / Initial Box */}
          <div className="relative rounded-xl overflow-hidden bg-[#17181E] border border-white/8 aspect-video flex items-center justify-center">
            {cameraOn ? (
              <>
                <video
                  ref={userVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
                  <span className="text-[10px] text-white/70">You</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                  <FiCameraOff size={20} className="text-red-400" />
                </div>
                <span className="text-xs text-red-300/90 font-medium">Camera required</span>
                <span className="text-[10px] text-white/40 leading-snug">
                  Reconnecting automatically…
                </span>
                <button
                  onClick={() => startCamera(true)}
                  className="mt-0.5 text-[10px] px-2.5 py-1 rounded-md bg-white/10 border border-white/15 text-white/80 hover:bg-white/15 transition-colors"
                >
                  Retry now
                </button>
              </div>
            )}
          </div>

          {/* Camera error / proctoring notice */}
          {cameraError && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-[11px] leading-snug text-center">
              {cameraError}
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-col items-center gap-1.5 pt-1">
            {micError && (
              <div className="w-full mb-1 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-[11px] leading-snug text-center">
                {micError}
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <motion.button
                whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                onClick={toggleMic}
                title={micOn ? "Mute mic" : "Unmute mic"}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                  micVisualOn ? "bg-white/10 border-white/15 text-white" : "bg-red-500/20 border-red-500/30 text-red-400"
                }`}
              >
                {micVisualOn ? <FiMic size={15} /> : <FiMicOff size={15} />}
              </motion.button>

              {/* Camera is proctored — this reports status and retries, it
                  never turns the camera off. */}
              <motion.button
                whileHover={{ scale: cameraOn ? 1 : 1.08 }} whileTap={{ scale: cameraOn ? 1 : 0.93 }}
                onClick={() => { if (!cameraOn) startCamera(true); }}
                title={cameraOn ? "Camera on — required for this interview" : "Camera off — click to retry"}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                  cameraOn
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 cursor-default"
                    : "bg-red-500/20 border-red-500/30 text-red-400 animate-pulse"
                }`}
              >
                {cameraOn ? <FiCamera size={15} /> : <FiCameraOff size={15} />}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                onClick={() => setCodeOpen(true)}
                title="Open code editor"
                className={`w-10 h-10 rounded-xl flex items-center justify-center border bg-white/5 border-white/10 text-white/45 hover:text-white/70 hover:border-white/20 transition-all ${isMCQ ? "hidden" : ""}`}
              >
                <FiCode size={15} />
              </motion.button>
            </div>

            {/* Indicator: mic on but paused because AI is speaking — reserved
                space so the layout doesn't jump */}
            <div className="min-h-[14px] flex items-center justify-center">
              {micOn && isAIPlaying && (
                <span className="text-[10px] text-red-400/80">Mic paused — AI is speaking</span>
              )}
              {micOn && !isAIPlaying && !micError && (
                <span className="text-[10px] text-emerald-400/70">Listening…</span>
              )}
            </div>

            {/* Proctoring log — only appears once something has actually happened */}
            {warnings.length > 0 && (
              <div className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-amber-300">
                    {warnings.length} proctoring {warnings.length === 1 ? "flag" : "flags"}
                  </span>
                  <span className="text-[10px] text-amber-300/60">{warnings[warnings.length - 1].at}</span>
                </div>
                <p className="text-[10px] text-amber-200/70 mt-0.5 leading-snug">
                  {warnings[warnings.length - 1].text}
                </p>
              </div>
            )}

            {/* Hint: code editor usage — irrelevant on a multiple-choice round */}
            <span className={`text-[10px] text-white/35 text-center ${isMCQ ? "hidden" : ""}`}>
              Coding question? Use <FiCode size={9} className="inline -mt-0.5" /> to write &amp; add code
            </span>
          </div>

        </div>

        {/* ── RIGHT: Question + Answer ── */}
        <div className="flex flex-col p-4 sm:p-6">

          {/* Header with timer on top right */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white">AI Interview</h2>
              <div className="flex items-center gap-2 text-zinc-500 text-xs mt-0.5">
                <FiClock size={11} />
                <span>{question?.difficulty}</span>
              </div>
            </div>

            {/* Timer — top right */}
            <div className="flex flex-col items-end gap-1.5 min-w-[110px]">
              <Timer timeLeft={timeLeft} totalTime={question?.timer || 60} />
            </div>
          </div>

          {/* Question Card */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key={question?.question}
            className="relative overflow-hidden rounded-xl bg-[#17181E] border border-white/8 p-4 sm:p-5 mb-4"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none" />
            <div className="relative flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center shrink-0">
                <FiMessageSquare size={14} />
              </div>
              <p className="text-xs text-zinc-500">Question {currentIndex + 1}</p>
            </div>
            <p className="relative text-white text-sm sm:text-base leading-7">{question.question}</p>
          </motion.div>

          {/* Progress — above answer input box */}
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-white/35 mb-1">
              <span>Progress</span>
              <span>{currentIndex + 1}/{interviewData.totalQuestions}</span>
            </div>
            <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Answer — MCQ for aptitude, free text otherwise */}
          {isMCQ ? (
            <div className="flex-1 flex flex-col min-h-0">
              <label className="text-xs font-medium text-zinc-400 mb-1.5">
                Choose one
                {question.category && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-600">
                    {question.category}
                  </span>
                )}
              </label>
              <div className="space-y-2">
                {question.options.map((opt, i) => {
                  const selected = answer === String(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAnswer(String(i))}
                      disabled={loading}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition-all flex items-start gap-3 disabled:opacity-60 ${
                        selected
                          ? "bg-white text-black border-white"
                          : "bg-[#17181E] border-white/10 text-white hover:border-white/30"
                      }`}
                    >
                      <span
                        className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold ${
                          selected ? "bg-black text-white" : "bg-white/10 text-white/70"
                        }`}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm leading-snug">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <label className="text-xs font-medium text-zinc-400 mb-1.5">Your Answer</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.ctrlKey && e.key === "Enter") submit(); }}
              rows={5}
              placeholder="Write your answer here… or speak if mic is on"
              className="flex-1 w-full rounded-xl bg-[#17181E] border border-white/8 p-4 text-sm text-white outline-none resize-none focus:border-white/25 transition placeholder-white/20"
            />

            {/* Live speech preview — words still being recognised. Kept out of
                the textarea so it can never fight with typing or get submitted
                half-formed. */}
            <div className="min-h-[22px] mt-1.5">
              {interim && (
                <div className="flex items-start gap-1.5 px-1">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <p className="text-[11px] text-white/40 italic leading-snug">{interim}</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Feedback — reserved space so the bottom bar doesn't jump */}
          <div className="mt-3 min-h-[0px]">
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 max-h-40 overflow-y-auto"
                >
                  <p className="text-xs uppercase tracking-widest text-green-400 mb-2">AI Feedback</p>
                  <p className="text-sm text-zinc-300 leading-6">{feedback.feedback}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/8">
            <span className="text-xs text-zinc-600 hidden sm:block">
              Press{" "}
              <kbd className="mx-1 rounded bg-white/10 px-1.5 py-0.5 text-white text-[10px]">Ctrl+Enter</kbd>
              to submit
            </span>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading || !answer.trim()}
              onClick={submit}
              className="ml-auto h-10 min-w-[150px] justify-center px-5 rounded-xl bg-white text-black text-sm font-semibold flex items-center gap-2 disabled:opacity-40 transition"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  Submitting…
                </>
              ) : (
                <>Submit Answer <FiArrowRight size={15} /></>
              )}
            </motion.button>
          </div>

        </div>
      </motion.div>
    </div>
  );
}

export default Step2Interview;