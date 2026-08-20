import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Editor from "@monaco-editor/react";
import { FiX, FiPlay, FiTerminal } from "react-icons/fi";
import { executeCode } from "../../api/interview.api";

const LANG_OPTIONS = ["javascript", "python", "java", "cpp", "typescript"];

const DEFAULT_CODE = {
  javascript: `// Write your solution here
function solution() {
  // your code
}`,
  python: `# Write your solution here
def solution():
    pass`,
  // The runner compiles to Main.java, so a public class named anything else
  // fails with "class X is public, should be declared in a file named X.java".
  java: `// Write your solution here
public class Main {
    public static void main(String[] args) {
        // your code
    }
}`,
  typescript: `// Write your solution here
function solution(): number {
  return 0;
}
console.log(solution());`,
  cpp: `// Write your solution here
#include <iostream>
using namespace std;

int main() {
    // your code
    return 0;
}`,
};

export default function CodeEditorPanel({ open, onClose, onSubmitCode }) {
  const [lang, setLang]       = useState("javascript");
  const [code, setCode]       = useState(DEFAULT_CODE["javascript"]);
  const [output, setOutput]   = useState("");
  const [running, setRunning] = useState(false);
  const [stdin, setStdin]     = useState("");

  const handleLangChange = (l) => {
    setLang(l);
    setCode(DEFAULT_CODE[l] || "");
    setOutput("");
  };

  // Runs on the server in a real sandbox for every supported language.
  // This used to be `new Function(code)` in the browser, which could only run
  // JavaScript and evaluated candidate code in the app's own page context.
  const runCode = async () => {
    setRunning(true);
    setOutput("");

    const res = await executeCode({ language: lang, code, stdin });

    if (!res) {
      setOutput("✗ Couldn't reach the code runner. Check that the interview service is running.");
      setRunning(false);
      return;
    }

    if (res.error) {
      setOutput(`✗ ${res.error}`);
      setRunning(false);
      return;
    }

    const parts = [];

    if (res.compileError) {
      parts.push("✗ Compilation failed\n");
      if (res.stderr) parts.push(res.stderr.trimEnd());
    } else {
      if (res.output) parts.push(res.output.trimEnd());
      if (res.stderr) parts.push((res.output ? "\n" : "") + res.stderr.trimEnd());

      if (!res.output && !res.stderr) {
        parts.push(res.ok ? "✓ Ran with no output." : "Ran with no output.");
      }

      const bits = [];
      if (res.exitCode !== null && res.exitCode !== undefined) bits.push(`exit ${res.exitCode}`);
      if (res.timeMs) bits.push(`${(res.timeMs / 1000).toFixed(1)}s`);
      if (bits.length) parts.push(`\n\n— ${bits.join(" · ")}`);
    }

    setOutput(parts.join("\n"));
    setRunning(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-x-3 top-4 bottom-4 sm:inset-x-6 sm:top-6 sm:bottom-6 md:inset-x-10 md:top-8 md:bottom-8 z-50 flex flex-col overflow-hidden rounded-2xl bg-[#0E1016] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
          >
            {/* glass sheen */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/8">
              <div className="flex items-center gap-3">
                <FiTerminal className="text-white/50" size={15} />
                <span className="text-sm font-semibold text-white">Code Editor</span>
              </div>

              {/* Language Selector */}
              <div className="flex items-center gap-1.5 mx-auto">
                {LANG_OPTIONS.map((l) => (
                  <button
                    key={l}
                    onClick={() => handleLangChange(l)}
                    className={`text-xs px-2.5 py-1 rounded-lg capitalize transition-all ${
                      lang === l
                        ? "bg-white text-[#0A0A0A] font-semibold"
                        : "text-white/40 hover:text-white/70 hover:bg-white/8"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <button
                onClick={onClose}
                className="text-white/35 hover:text-white transition-colors"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Editor */}
            <div className="relative flex-1 min-h-0">
              <Editor
                height="100%"
                language={lang}
                value={code}
                onChange={(v) => setCode(v || "")}
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  padding: { top: 12 },
                  fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                  fontLigatures: true,
                  renderLineHighlight: "line",
                  cursorBlinking: "smooth",
                }}
              />
            </div>

            {/* Terminal — every language runs server-side now */}
            <div className="relative border-t border-white/8">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`w-2 h-2 rounded-full ${running ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`} />
                  <span className="text-xs text-white/40 font-mono">Terminal</span>
                </div>

                {/* stdin — needed for the many interview problems that read input */}
                <input
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="stdin (optional)"
                  className="flex-1 min-w-0 max-w-xs h-7 rounded-lg bg-black/30 border border-white/10 px-2.5 text-[11px] font-mono text-white/80 outline-none focus:border-white/25 transition placeholder-white/20"
                />

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={runCode}
                    disabled={running}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-white/70 hover:text-white hover:bg-white/15 disabled:opacity-50 transition-all"
                  >
                    <FiPlay size={11} />
                    {running ? "Running…" : "Run"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSubmitCode?.(code)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white text-[#0A0A0A] font-semibold hover:bg-white/90 transition-all"
                  >
                    Add to Answer
                  </button>
                </div>
              </div>
              <div className="h-24 sm:h-28 overflow-y-auto px-4 py-3 font-mono text-xs whitespace-pre-wrap bg-black/30">
                {output
                  ? <span className={output.startsWith("✗") ? "text-red-400" : "text-emerald-400"}>{output}</span>
                  : <span className="text-white/20">{`// Output will appear here after running`}</span>
                }
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}