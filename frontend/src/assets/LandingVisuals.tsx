import React from 'react';

// ============================================================================
// WARM EDITORIAL BESPOKE VISUAL ARTWORK
// Palette tokens:
// #FCF0DA (Warm Cream Parchment)
// #AEAC78 (Sage Olive)
// #F2C46A (Golden Amber)
// #4C4541 (Deep Espresso Ink)
// #FFFDF9 (Warm Ivory)
// #F7E8C8 (Linen Accent)
// #2E6B56 (Forest Sage / Verified)
// #8F3D2C (Terracotta / Security Wall)
// ============================================================================

export const DockerSandboxVisual: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div data-testid="pillar-illustration" className={`w-full overflow-hidden rounded-xl border border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] p-3 shadow-inner ${className}`}>
    <svg viewBox="0 0 540 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      {/* Background grid */}
      <defs>
        <pattern id="sandboxGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#AEAC78" fillOpacity="0.25" />
        </pattern>
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8F3D2C" />
          <stop offset="100%" stopColor="#4C4541" />
        </linearGradient>
      </defs>
      <rect width="540" height="240" rx="10" fill="url(#sandboxGrid)" />

      {/* Main Container Boundary */}
      <rect x="15" y="15" width="510" height="210" rx="12" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="2" strokeDasharray="6 4" className="dark:fill-[#2C2623]" />
      
      {/* Container Header Banner */}
      <rect x="25" y="25" width="490" height="32" rx="6" fill="#F7E8C8" className="dark:fill-[#4C4541]" />
      <circle cx="45" cy="41" r="5" fill="#2E6B56" />
      <circle cx="60" cy="41" r="5" fill="#F2C46A" />
      <circle cx="75" cy="41" r="5" fill="#8F3D2C" />
      <text x="95" y="45" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="11" fontFamily="monospace" fontWeight="700">
        DOCKER CONTAINER: alpine:3.19 (cgroups strict / --network none)
      </text>

      {/* Left Block: Read-Only Volume */}
      <rect x="35" y="70" width="140" height="90" rx="8" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#38322E]" />
      <rect x="35" y="70" width="140" height="24" rx="8" fill="#AEAC78" fillOpacity="0.2" />
      <text x="45" y="86" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="10" fontFamily="monospace" fontWeight="700">READ-ONLY MOUNT</text>
      <text x="45" y="108" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace">/sandbox/src/</text>
      <text x="45" y="124" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">submission.py: ro</text>
      <text x="45" y="138" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">tests/test_spec.py</text>
      <rect x="45" y="145" width="80" height="12" rx="3" fill="#2E6B56" fillOpacity="0.2" />
      <text x="50" y="154" fill="#2E6B56" fontSize="8" fontFamily="sans-serif" fontWeight="700">NO WRITE ACCESS</text>

      {/* Middle Block: Security Wall */}
      <rect x="195" y="70" width="150" height="90" rx="8" fill="#FFFDF9" stroke="#8F3D2C" strokeWidth="1.5" className="dark:fill-[#38322E]" />
      <rect x="195" y="70" width="150" height="24" rx="8" fill="#8F3D2C" fillOpacity="0.15" />
      <text x="205" y="86" fill="#8F3D2C" fontSize="10" fontFamily="monospace" fontWeight="700">NETWORK WALL</text>
      <path d="M260 102 L280 102 L270 120 Z" fill="#8F3D2C" />
      <text x="210" y="118" fill="#8F3D2C" fontSize="9" fontFamily="monospace" fontWeight="700">--network none</text>
      <text x="205" y="134" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">0 socket connections</text>
      <text x="205" y="148" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Exfiltration Blocked</text>

      {/* Right Block: In-Container Pytest Plugin */}
      <rect x="365" y="70" width="140" height="90" rx="8" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#38322E]" />
      <rect x="365" y="70" width="140" height="24" rx="8" fill="#F2C46A" fillOpacity="0.3" />
      <text x="375" y="86" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="10" fontFamily="monospace" fontWeight="700">IN-SANDBOX RUN</text>
      <text x="375" y="108" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace">pytest-json-plugin</text>
      <text x="375" y="124" fill="#2E6B56" fontSize="8" fontFamily="sans-serif" fontWeight="700">10s SIGKILL Guard</text>
      <text x="375" y="138" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">256MB RAM / 1 vCPU</text>
      <rect x="375" y="144" width="90" height="12" rx="3" fill="#F2C46A" fillOpacity="0.4" />
      <text x="380" y="153" fill="#4C4541" fontSize="8" fontFamily="sans-serif" fontWeight="700">STRUCTURED JSON</text>

      {/* Bottom Output Stream */}
      <rect x="35" y="172" width="470" height="40" rx="8" fill="#F7E8C8" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#4C4541]" />
      <text x="50" y="188" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">SANDBOX OUT: Exit Code 0 · 14 assertions passed · Duration: 842ms · Zero Leaks</text>
      <text x="50" y="202" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Verified kernel isolation via Linux namespaces &amp; seccomp profile</text>
    </svg>
  </div>
);

export const SimilarityAstVisual: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div data-testid="pillar-illustration" className={`w-full overflow-hidden rounded-xl border border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] p-3 shadow-inner ${className}`}>
    <svg viewBox="0 0 540 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      {/* Background Frame */}
      <rect x="15" y="15" width="510" height="210" rx="12" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#2C2623]" />
      
      {/* Header */}
      <rect x="25" y="25" width="490" height="30" rx="6" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <text x="40" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="11" fontFamily="monospace" fontWeight="700">
        DUAL-ENGINE SIMILARITY: Karp-Rabin Token Winnowing + JPlag 6.2.0 AST
      </text>
      <rect x="420" y="31" width="85" height="18" rx="4" fill="#F2C46A" />
      <text x="430" y="44" fill="#4C4541" fontSize="9" fontFamily="sans-serif" fontWeight="700">94.8% Match</text>

      {/* Left Code Pane: Submission A */}
      <rect x="30" y="65" width="180" height="100" rx="8" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect x="30" y="65" width="180" height="20" rx="8" fill="#F7E8C8" className="dark:fill-[#4C4541]" />
      <text x="40" y="79" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">Student A (dfs_walk)</text>
      <text x="40" y="100" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">1: def traverse(graph, start):</text>
      <rect x="40" y="105" width="155" height="14" fill="#F2C46A" fillOpacity="0.3" rx="2" />
      <text x="40" y="116" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="monospace">2:   visited = set()</text>
      <rect x="40" y="120" width="155" height="14" fill="#F2C46A" fillOpacity="0.3" rx="2" />
      <text x="40" y="131" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="monospace">3:   stack = [start]</text>
      <text x="40" y="146" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">4:   while stack: ...</text>

      {/* Middle Filter: Starter Code Subtraction */}
      <rect x="225" y="75" width="90" height="80" rx="8" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <text x="235" y="93" fill="#8F3D2C" fontSize="8" fontFamily="sans-serif" fontWeight="700">BASE SUBTRACT</text>
      <path d="M245 105 L295 105" stroke="#AEAC78" strokeWidth="1.5" strokeDasharray="3 3" />
      <text x="235" y="120" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="7" fontFamily="sans-serif">Instructor template</text>
      <text x="235" y="130" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="7" fontFamily="sans-serif">tokens filtered</text>
      <rect x="235" y="136" width="70" height="12" rx="3" fill="#2E6B56" fillOpacity="0.2" />
      <text x="240" y="145" fill="#2E6B56" fontSize="7" fontFamily="sans-serif" fontWeight="700">0% False Positives</text>

      {/* Right Code Pane: Submission B */}
      <rect x="330" y="65" width="180" height="100" rx="8" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect x="330" y="65" width="180" height="20" rx="8" fill="#F7E8C8" className="dark:fill-[#4C4541]" />
      <text x="340" y="79" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">Student B (explore_v2)</text>
      <text x="340" y="100" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">1: def run_dfs(g, root):</text>
      <rect x="340" y="105" width="155" height="14" fill="#F2C46A" fillOpacity="0.3" rx="2" />
      <text x="340" y="116" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="monospace">2:   seen = set()  # renamed</text>
      <rect x="340" y="120" width="155" height="14" fill="#F2C46A" fillOpacity="0.3" rx="2" />
      <text x="340" y="131" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="monospace">3:   q = [root]    # renamed</text>
      <text x="340" y="146" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">4:   while q: ...</text>

      {/* Bottom AST Tree Fingerprint */}
      <rect x="30" y="175" width="480" height="40" rx="6" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <text x="45" y="192" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">AST Normalized Grammars: FunctionDef &gt; Assign(Set) &gt; Assign(List) &gt; While(Name)</text>
      <text x="45" y="206" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Variable renaming &amp; whitespace changes bypassed — Identical grammatical control flow detected</text>
    </svg>
  </div>
);

export const RubricEngineVisual: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div data-testid="pillar-illustration" className={`w-full overflow-hidden rounded-xl border border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] p-3 shadow-inner ${className}`}>
    <svg viewBox="0 0 540 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      {/* Background Frame */}
      <rect x="15" y="15" width="510" height="210" rx="12" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#2C2623]" />

      {/* Top Formula Bar */}
      <rect x="25" y="25" width="490" height="32" rx="6" fill="#F7E8C8" className="dark:fill-[#4C4541]" />
      <text x="40" y="45" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="11" fontFamily="monospace" fontWeight="700">
        4-TIER FORMULA: Grade = 0.40(Tests) + 0.20(Ruff) + 0.20(AST) + 0.20(Manual) = 100.0%
      </text>

      {/* 4 Tier Cards */}
      {/* Tier 1: Automated Pytest */}
      <g transform="translate(30, 68)">
        <rect width="115" height="100" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
        <rect width="115" height="22" rx="8" fill="#2E6B56" fillOpacity="0.2" />
        <text x="10" y="15" fill="#2E6B56" fontSize="9" fontFamily="monospace" fontWeight="700">TIER 1: 40%</text>
        <text x="10" y="34" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif" fontWeight="700">Pytest Suite</text>
        <text x="10" y="48" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Public &amp; Hidden</text>
        <rect x="10" y="58" width="95" height="10" rx="5" fill="#AEAC78" fillOpacity="0.3" />
        <rect x="10" y="58" width="95" height="10" rx="5" fill="#2E6B56" />
        <text x="10" y="80" fill="#2E6B56" fontSize="9" fontFamily="monospace" fontWeight="700">10/10 Passed</text>
        <text x="10" y="92" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="sans-serif">Weight: 40.0 pts</text>
      </g>

      {/* Tier 2: Static Ruff Quality */}
      <g transform="translate(155, 68)">
        <rect width="115" height="100" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
        <rect width="115" height="22" rx="8" fill="#F2C46A" fillOpacity="0.3" />
        <text x="10" y="15" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">TIER 2: 20%</text>
        <text x="10" y="34" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif" fontWeight="700">Ruff Lint &amp; Style</text>
        <text x="10" y="48" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">PEP-8 &amp; Docstrings</text>
        <rect x="10" y="58" width="95" height="10" rx="5" fill="#AEAC78" fillOpacity="0.3" />
        <rect x="10" y="58" width="85" height="10" rx="5" fill="#F2C46A" />
        <text x="10" y="80" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">1 Warning (E501)</text>
        <text x="10" y="92" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="sans-serif">Weight: 18.0 pts</text>
      </g>

      {/* Tier 3: McCabe Complexity */}
      <g transform="translate(280, 68)">
        <rect width="115" height="100" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
        <rect width="115" height="22" rx="8" fill="#AEAC78" fillOpacity="0.3" />
        <text x="10" y="15" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">TIER 3: 20%</text>
        <text x="10" y="34" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif" fontWeight="700">AST Complexity</text>
        <text x="10" y="48" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">McCabe Metric M=3</text>
        <rect x="10" y="58" width="95" height="10" rx="5" fill="#AEAC78" fillOpacity="0.3" />
        <rect x="10" y="58" width="95" height="10" rx="5" fill="#AEAC78" />
        <text x="10" y="80" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">Optimal (M &lt; 5)</text>
        <text x="10" y="92" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="sans-serif">Weight: 20.0 pts</text>
      </g>

      {/* Tier 4: Manual Assessment */}
      <g transform="translate(405, 68)">
        <rect width="105" height="100" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
        <rect width="105" height="22" rx="8" fill="#4C4541" fillOpacity="0.15" />
        <text x="10" y="15" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">TIER 4: 20%</text>
        <text x="10" y="34" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif" fontWeight="700">Lecturer Review</text>
        <text x="10" y="48" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Algorithmic Clarity</text>
        <rect x="10" y="58" width="85" height="10" rx="5" fill="#AEAC78" fillOpacity="0.3" />
        <rect x="10" y="58" width="85" height="10" rx="5" fill="#4C4541" />
        <text x="10" y="80" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">Confirmed</text>
        <text x="10" y="92" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="sans-serif">Weight: 20.0 pts</text>
      </g>

      {/* Bottom Summary Bar */}
      <rect x="30" y="178" width="480" height="34" rx="6" fill="#F7E8C8" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#4C4541]" />
      <text x="45" y="199" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="10" fontFamily="sans-serif" fontWeight="700">
        Deterministic Total: 98.0 / 100.0 pts (Validated 100% Weight Integrity · Floating-point Exactness)
      </text>
    </svg>
  </div>
);

export const GroundedAiVisual: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div data-testid="pillar-illustration" className={`w-full overflow-hidden rounded-xl border border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] p-3 shadow-inner ${className}`}>
    <svg viewBox="0 0 540 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      {/* Background Frame */}
      <rect x="15" y="15" width="510" height="210" rx="12" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#2C2623]" />

      {/* Banner */}
      <rect x="25" y="25" width="490" height="30" rx="6" fill="#F7E8C8" className="dark:fill-[#4C4541]" />
      <text x="40" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="11" fontFamily="monospace" fontWeight="700">
        EVIDENCE-GROUNDED ADVISORY PIPELINE: Strict Citations &middot; No Hallucination
      </text>

      {/* Column 1: Evidence Manifest */}
      <g transform="translate(30, 65)">
        <rect width="140" height="105" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
        <rect width="140" height="20" rx="8" fill="#AEAC78" fillOpacity="0.25" />
        <text x="10" y="14" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">EVIDENCE MANIFEST</text>
        <rect x="8" y="28" width="124" height="16" rx="4" fill="#2E6B56" fillOpacity="0.2" />
        <text x="14" y="39" fill="#2E6B56" fontSize="8" fontFamily="monospace" fontWeight="700">[EVID_TEST_01]: Passed</text>
        <rect x="8" y="48" width="124" height="16" rx="4" fill="#F2C46A" fillOpacity="0.3" />
        <text x="14" y="59" fill="#4C4541" fontSize="8" fontFamily="monospace" fontWeight="700">[EVID_LINT_04]: Line 42</text>
        <rect x="8" y="68" width="124" height="16" rx="4" fill="#AEAC78" fillOpacity="0.3" />
        <text x="14" y="79" fill="#4C4541" fontSize="8" fontFamily="monospace" fontWeight="700">[EVID_AST_02]: McCabe 3</text>
        <text x="10" y="98" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="7" fontFamily="sans-serif">Zero unreferenced tokens</text>
      </g>

      {/* Arrow 1 */}
      <path d="M178 115 L200 115" stroke="#AEAC78" strokeWidth="2" strokeDasharray="3 3" />
      <polygon points="200,111 207,115 200,119" fill="#AEAC78" />

      {/* Column 2: Prompt Grounding Engine */}
      <g transform="translate(212, 65)">
        <rect width="140" height="105" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
        <rect width="140" height="20" rx="8" fill="#F2C46A" fillOpacity="0.3" />
        <text x="10" y="14" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">AI PROMPT ANCHORS</text>
        <text x="10" y="34" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="sans-serif" fontWeight="700">Google Gemini &amp; OpenAI</text>
        <text x="10" y="48" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="7" fontFamily="sans-serif">System constraint:</text>
        <text x="10" y="60" fill="#8F3D2C" fontSize="7" fontFamily="monospace">&quot;Cite [EVID_*] or omit&quot;</text>
        <rect x="10" y="68" width="120" height="18" rx="4" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="0.8" className="dark:fill-[#2C2623]" />
        <text x="15" y="80" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="7" fontFamily="sans-serif">Deterministic Offline Fallback</text>
        <text x="10" y="98" fill="#2E6B56" fontSize="7" fontFamily="sans-serif" fontWeight="700">No hallucinated criteria</text>
      </g>

      {/* Arrow 2 */}
      <path d="M360 115 L382 115" stroke="#AEAC78" strokeWidth="2" strokeDasharray="3 3" />
      <polygon points="382,111 389,115 382,119" fill="#AEAC78" />

      {/* Column 3: Lecturer Approval Draft */}
      <g transform="translate(394, 65)">
        <rect width="120" height="105" rx="8" fill="#FCF0DA" stroke="#F2C46A" strokeWidth="1.5" className="dark:fill-[#38322E]" />
        <rect width="120" height="20" rx="8" fill="#F2C46A" fillOpacity="0.4" />
        <text x="8" y="14" fill="#4C4541" fontSize="9" fontFamily="monospace" fontWeight="700">LECTURER DRAFT</text>
        <text x="8" y="34" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="sans-serif">Pedagogical Advice:</text>
        <text x="8" y="46" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="7" fontFamily="sans-serif">Ref [EVID_TEST_01]</text>
        <text x="8" y="56" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="7" fontFamily="sans-serif">Ref [EVID_LINT_04]</text>
        <rect x="8" y="66" width="104" height="22" rx="4" fill="#4C4541" />
        <text x="12" y="80" fill="#FCF0DA" fontSize="8" fontFamily="sans-serif" fontWeight="700">HUMAN CONFIRMATION</text>
        <text x="8" y="100" fill="#2E6B56" fontSize="7" fontFamily="sans-serif" fontWeight="700">Lecturer Sign-Off</text>
      </g>

      {/* Bottom guarantee */}
      <rect x="30" y="178" width="480" height="34" rx="6" fill="#F7E8C8" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#4C4541]" />
      <text x="45" y="199" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="10" fontFamily="sans-serif" fontWeight="700">
        Guarantee: 100% of student-facing advice is reviewed and signed off by the course lecturer before release.
      </text>
    </svg>
  </div>
);

// ============================================================================
// 5 LIFECYCLE STAGE BESPOKE ARCHITECTURAL SVG DIAGRAMS
// Each stage has a distinct visual topology tailored to its engineering role.
// ============================================================================

export const Stage1IngestDiagram: React.FC = () => (
  <svg data-testid="pipeline-diagram-svg" viewBox="0 0 680 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
    <rect width="680" height="160" rx="10" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#2C2623]" />

    {/* Left: Nested ZIP Archive Tree */}
    <g transform="translate(18, 18)">
      <rect width="195" height="124" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1.2" className="dark:fill-[#38322E]" />
      <rect width="195" height="24" rx="8" fill="#F2C46A" fillOpacity="0.35" />
      <text x="12" y="16" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="10" fontFamily="monospace" fontWeight="700">1. LMS ARCHIVE TREE</text>
      {/* Tree lines */}
      <path d="M20 36 V106 M20 48 H34 M20 68 H34 M20 88 H34 M20 106 H34" stroke="#AEAC78" strokeWidth="1.5" />
      <text x="38" y="51" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8.5" fontFamily="monospace" fontWeight="700">batch_cs101.zip (42 MB)</text>
      <text x="38" y="71" fill="#2E6B56" fontSize="8" fontFamily="monospace">student_2012/solution.py</text>
      <text x="38" y="91" fill="#2E6B56" fontSize="8" fontFamily="monospace">student_2045/solution.py</text>
      <rect x="36" y="97" width="146" height="15" rx="3" fill="#8F3D2C" fillOpacity="0.15" />
      <text x="40" y="108" fill="#8F3D2C" fontSize="8" fontFamily="monospace" fontWeight="700">../../etc/passwd [BLOCKED]</text>
    </g>

    {/* Arrow 1 */}
    <path d="M220 80 L252 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 3" />
    <polygon points="252,75 262,80 252,85" fill="#AEAC78" />

    {/* Center: Security Sanitizer Gate & Filter Funnel */}
    <g transform="translate(268, 18)">
      <polygon points="0,10 150,24 150,100 0,114" fill="#FCF0DA" stroke="#8F3D2C" strokeWidth="1.5" className="dark:fill-[#38322E]" />
      <rect x="12" y="28" width="126" height="18" rx="4" fill="#8F3D2C" fillOpacity="0.18" />
      <text x="18" y="40" fill="#8F3D2C" fontSize="9" fontFamily="monospace" fontWeight="700">2. ZIP-SLIP SHIELD</text>
      <text x="16" y="58" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8.5" fontFamily="sans-serif" fontWeight="700">Path Canonicalization</text>
      <text x="16" y="72" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">realpath() == sandbox_root</text>
      <text x="16" y="86" fill="#2E6B56" fontSize="8" fontFamily="sans-serif" fontWeight="700">UTF-8 + LF Normalization</text>
    </g>

    {/* Arrow 2 */}
    <path d="M425 80 L457 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 3" />
    <polygon points="457,75 467,80 457,85" fill="#2E6B56" />

    {/* Right: Indexed Checksum Ledger Stack */}
    <g transform="translate(474, 18)">
      <rect width="188" height="124" rx="8" fill="#FCF0DA" stroke="#2E6B56" strokeWidth="1.2" className="dark:fill-[#38322E]" />
      <rect width="188" height="24" rx="8" fill="#2E6B56" fillOpacity="0.2" />
      <text x="12" y="16" fill="#2E6B56" fontSize="10" fontFamily="monospace" fontWeight="700">3. SHA-256 MANIFEST DB</text>
      {/* Stacked database rows */}
      <rect x="12" y="34" width="164" height="22" rx="4" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#2C2623]" />
      <text x="18" y="48" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="monospace">#1001 · sha256:a8f4..9c · READY</text>
      <rect x="12" y="62" width="164" height="22" rx="4" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#2C2623]" />
      <text x="18" y="76" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="monospace">#1002 · sha256:7b12..3e · READY</text>
      <rect x="12" y="92" width="164" height="20" rx="4" fill="#2E6B56" fillOpacity="0.2" />
      <text x="20" y="105" fill="#2E6B56" fontSize="8.5" fontFamily="sans-serif" fontWeight="700">Idempotent Queue Dispatched</text>
    </g>
  </svg>
);

export const Stage2SandboxDiagram: React.FC = () => (
  <svg data-testid="pipeline-diagram-svg" viewBox="0 0 680 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
    <rect width="680" height="160" rx="10" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#2C2623]" />

    {/* Outer Kernel Isolation Boundary */}
    <rect x="14" y="12" width="652" height="136" rx="10" fill="#FCF0DA" fillOpacity="0.55" stroke="#8F3D2C" strokeWidth="1.5" strokeDasharray="6 4" className="dark:fill-[#38322E]" />
    <rect x="24" y="20" width="320" height="18" rx="4" fill="#8F3D2C" />
    <text x="32" y="32" fill="#FCF0DA" fontSize="9" fontFamily="monospace" fontWeight="700">KERNEL AIR-GAP: --network none · --cap-drop ALL · ro-mount</text>

    {/* Left: cgroups Resource Gauges */}
    <g transform="translate(26, 46)">
      <rect width="195" height="92" rx="7" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#2C2623]" />
      <text x="12" y="18" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9.5" fontFamily="monospace" fontWeight="700">CGROUPS RESOURCE GUARD</text>
      <text x="12" y="36" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">RAM: 64MB / 256MB Hard Cap</text>
      <rect x="12" y="42" width="170" height="8" rx="4" fill="#AEAC78" fillOpacity="0.25" />
      <rect x="12" y="42" width="52" height="8" rx="4" fill="#2E6B56" />
      <text x="12" y="64" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">CPU Quota: 1.0 vCPU · Pids: 32</text>
      <rect x="12" y="70" width="170" height="8" rx="4" fill="#AEAC78" fillOpacity="0.25" />
      <rect x="12" y="70" width="90" height="8" rx="4" fill="#F2C46A" />
    </g>

    {/* Center: Watchdog Execution Timeline */}
    <g transform="translate(236, 46)">
      <rect width="215" height="92" rx="7" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#2C2623]" />
      <text x="12" y="18" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9.5" fontFamily="monospace" fontWeight="700">PYTEST WATCHDOG (10.0s MAX)</text>
      {/* Timeline axis */}
      <line x1="16" y1="48" x2="198" y2="48" stroke="#AEAC78" strokeWidth="2" />
      <circle cx="30" cy="48" r="5" fill="#2E6B56" />
      <circle cx="80" cy="48" r="5" fill="#2E6B56" />
      <circle cx="130" cy="48" r="5" fill="#2E6B56" />
      <line x1="185" y1="34" x2="185" y2="62" stroke="#8F3D2C" strokeWidth="2" />
      <text x="20" y="36" fill="#2E6B56" fontSize="7.5" fontFamily="monospace">0.0s</text>
      <text x="68" y="36" fill="#2E6B56" fontSize="7.5" fontFamily="monospace">0.4s</text>
      <text x="115" y="36" fill="#2E6B56" fontSize="7.5" fontFamily="monospace">0.84s DONE</text>
      <text x="155" y="74" fill="#8F3D2C" fontSize="7.5" fontFamily="monospace" fontWeight="700">10s SIGKILL</text>
      <text x="14" y="82" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Infinite-loop protection active</text>
    </g>

    {/* Right: Structured JSON Output */}
    <g transform="translate(466, 46)">
      <rect width="188" height="92" rx="7" fill="#241F1C" stroke="#AEAC78" strokeWidth="1" />
      <text x="12" y="18" fill="#F2C46A" fontSize="9" fontFamily="monospace" fontWeight="700">report.json (stdout)</text>
      <text x="12" y="36" fill="#FCF0DA" fontSize="8" fontFamily="monospace">{`{ "exit_code": 0,`}</text>
      <text x="12" y="50" fill="#6EE7B7" fontSize="8" fontFamily="monospace">{`  "passed": 10, "failed": 0,`}</text>
      <text x="12" y="64" fill="#93C5FD" fontSize="8" fontFamily="monospace">{`  "duration_ms": 842,`}</text>
      <text x="12" y="78" fill="#FCF0DA" fontSize="8" fontFamily="monospace">{`  "evidence": ["EVID_TEST_*"] }`}</text>
    </g>
  </svg>
);

export const Stage3EvidenceDiagram: React.FC = () => (
  <svg data-testid="pipeline-diagram-svg" viewBox="0 0 680 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
    <rect width="680" height="160" rx="10" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#2C2623]" />

    {/* Left: 3 Parallel Analyzers */}
    <g transform="translate(18, 14)">
      <rect y="0" width="195" height="38" rx="6" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <text x="10" y="16" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">RUFF STATIC LINTER</text>
      <text x="10" y="30" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">PEP-8 · F401 · E501 Line Spans</text>

      <rect y="47" width="195" height="38" rx="6" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <text x="10" y="63" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">AST COMPLEXITY GRAPH</text>
      <text x="10" y="77" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">FunctionDef -&gt; Branch M = 3</text>

      <rect y="94" width="195" height="38" rx="6" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <text x="10" y="110" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">WINNOWING + JPLAG 6.2</text>
      <text x="10" y="124" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">k-gram hashes (base subtracted)</text>
    </g>

    {/* Converging Fan-In Bus Lines */}
    <path d="M213 33 L275 80 M213 66 L275 80 M213 113 L275 80" stroke="#AEAC78" strokeWidth="2" />
    <circle cx="275" cy="80" r="5" fill="#F2C46A" stroke="#4C4541" strokeWidth="1.5" />

    {/* Center: AST Node & Fingerprint Visualizer */}
    <g transform="translate(288, 22)">
      <rect width="160" height="116" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1.2" className="dark:fill-[#38322E]" />
      <text x="14" y="18" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="monospace" fontWeight="700">AST &amp; HASH NORMALIZER</text>
      {/* Mini AST Graph */}
      <circle cx="80" cy="38" r="9" fill="#F2C46A" />
      <line x1="80" y1="47" x2="50" y2="70" stroke="#4C4541" strokeWidth="1.5" />
      <line x1="80" y1="47" x2="110" y2="70" stroke="#4C4541" strokeWidth="1.5" />
      <circle cx="50" cy="74" r="8" fill="#2E6B56" />
      <circle cx="110" cy="74" r="8" fill="#AEAC78" />
      <text x="18" y="102" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="monospace">Line-mapped anchor IDs</text>
    </g>

    <path d="M448 80 L476 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 3" />
    <polygon points="476,75 486,80 476,85" fill="#2E6B56" />

    {/* Right: Immutable Evidence Manifest */}
    <g transform="translate(492, 18)">
      <rect width="170" height="124" rx="8" fill="#FFFDF9" stroke="#2E6B56" strokeWidth="1.5" className="dark:fill-[#38322E]" />
      <rect width="170" height="24" rx="8" fill="#2E6B56" fillOpacity="0.2" />
      <text x="12" y="16" fill="#2E6B56" fontSize="9.5" fontFamily="monospace" fontWeight="700">EVIDENCE MANIFEST</text>
      <rect x="10" y="32" width="150" height="22" rx="4" fill="#2E6B56" fillOpacity="0.15" />
      <text x="16" y="46" fill="#2E6B56" fontSize="8" fontFamily="monospace" fontWeight="700">[EVID_TEST_03] L7-L10</text>
      <rect x="10" y="60" width="150" height="22" rx="4" fill="#F2C46A" fillOpacity="0.3" />
      <text x="16" y="74" fill="#4C4541" fontSize="8" fontFamily="monospace" fontWeight="700">[EVID_LINT_01] PEP-8 OK</text>
      <rect x="10" y="88" width="150" height="22" rx="4" fill="#AEAC78" fillOpacity="0.25" />
      <text x="16" y="102" fill="#4C4541" fontSize="8" fontFamily="monospace" fontWeight="700">[EVID_SIM_00] 4.2% Clean</text>
    </g>
  </svg>
);

export const Stage4AiDraftDiagram: React.FC = () => (
  <svg data-testid="pipeline-diagram-svg" viewBox="0 0 680 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
    <rect width="680" height="160" rx="10" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#2C2623]" />

    {/* Left: Grounding Context Inputs */}
    <g transform="translate(18, 20)">
      <rect width="176" height="120" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="176" height="24" rx="8" fill="#AEAC78" fillOpacity="0.25" />
      <text x="12" y="16" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9.5" fontFamily="monospace" fontWeight="700">VERIFIED ANCHOR LOCK</text>
      <rect x="12" y="34" width="152" height="20" rx="4" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#2C2623]" />
      <text x="18" y="47" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="monospace">Anchor 1: [EVID_TEST_03]</text>
      <rect x="12" y="60" width="152" height="20" rx="4" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#2C2623]" />
      <text x="18" y="73" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="monospace">Anchor 2: [EVID_AST_01]</text>
      <rect x="12" y="86" width="152" height="22" rx="4" fill="#8F3D2C" fillOpacity="0.15" />
      <text x="18" y="100" fill="#8F3D2C" fontSize="8" fontFamily="monospace" fontWeight="700">Reject uncited claims</text>
    </g>

    <path d="M194 80 L232 80" stroke="#F2C46A" strokeWidth="2.5" />
    <polygon points="232,75 242,80 232,85" fill="#F2C46A" />

    {/* Center: Dual Synthesis Engine (LLM + Deterministic Fallback Switch) */}
    <g transform="translate(246, 20)">
      <rect width="190" height="120" rx="8" fill="#FCF0DA" stroke="#F2C46A" strokeWidth="1.5" className="dark:fill-[#38322E]" />
      <rect width="190" height="24" rx="8" fill="#F2C46A" fillOpacity="0.4" />
      <text x="12" y="16" fill="#4C4541" fontSize="9.5" fontFamily="monospace" fontWeight="700">CITATION SYNTHESIZER</text>
      <rect x="12" y="34" width="166" height="34" rx="5" fill="#FFFDF9" stroke="#2E6B56" strokeWidth="1" className="dark:fill-[#2C2623]" />
      <text x="18" y="48" fill="#2E6B56" fontSize="8.5" fontFamily="sans-serif" fontWeight="700">Primary: Gemini / GPT-4o</text>
      <text x="18" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="7.5" fontFamily="monospace">JSON Schema + [EVID_*] Validator</text>
      <rect x="12" y="76" width="166" height="34" rx="5" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#2C2623]" />
      <text x="18" y="90" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8.5" fontFamily="sans-serif" fontWeight="700">Fallback: Offline Rulebook</text>
      <text x="18" y="102" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="7.5" fontFamily="monospace">100% deterministic template</text>
    </g>

    <path d="M436 80 L474 80" stroke="#2E6B56" strokeWidth="2.5" />
    <polygon points="474,75 484,80 474,85" fill="#2E6B56" />

    {/* Right: Grounded Pedagogical Draft Card */}
    <g transform="translate(488, 20)">
      <rect width="174" height="120" rx="8" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.2" className="dark:fill-[#38322E]" />
      <rect width="174" height="24" rx="8" fill="#2E6B56" fillOpacity="0.2" />
      <text x="12" y="16" fill="#2E6B56" fontSize="9.5" fontFamily="monospace" fontWeight="700">GROUNDED DRAFT</text>
      <text x="12" y="40" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="sans-serif">&quot;Hash-set lookup on L7</text>
      <text x="12" y="52" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="sans-serif">passes all boundary cases.&quot;</text>
      <rect x="12" y="62" width="96" height="16" rx="3" fill="#F2C46A" fillOpacity="0.45" />
      <text x="16" y="73" fill="#4C4541" fontSize="8" fontFamily="monospace" fontWeight="700">Ref: EVID_TEST_03</text>
      <rect x="12" y="88" width="150" height="20" rx="4" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#2C2623]" />
      <text x="18" y="101" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">Status: DRAFT (Unconfirmed)</text>
    </g>
  </svg>
);

export const Stage5ReviewDiagram: React.FC = () => (
  <svg data-testid="pipeline-diagram-svg" viewBox="0 0 680 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
    <rect width="680" height="160" rx="10" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#2C2623]" />

    {/* Left: 3-Column IDE Studio Mini Mockup */}
    <g transform="translate(18, 18)">
      <rect width="230" height="124" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1.2" className="dark:fill-[#38322E]" />
      <rect width="230" height="22" rx="8" fill="#4C4541" />
      <text x="12" y="15" fill="#FCF0DA" fontSize="9" fontFamily="monospace" fontWeight="700">INSTRUCTOR 3-PANE WORKSTATION</text>
      {/* 3 mini panes */}
      <rect x="10" y="30" width="52" height="84" rx="4" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#2C2623]" />
      <text x="16" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="7.5" fontFamily="monospace" fontWeight="700">Queue</text>
      <rect x="14" y="52" width="44" height="10" rx="2" fill="#F2C46A" />
      <rect x="14" y="66" width="44" height="10" rx="2" fill="#AEAC78" fillOpacity="0.3" />
      <rect x="68" y="30" width="82" height="84" rx="4" fill="#241F1C" />
      <text x="74" y="44" fill="#F2C46A" fontSize="7.5" fontFamily="monospace">solution.py</text>
      <rect x="74" y="52" width="70" height="8" rx="2" fill="#F2C46A" fillOpacity="0.35" />
      <rect x="74" y="64" width="60" height="6" rx="2" fill="#FCF0DA" fillOpacity="0.3" />
      <rect x="156" y="30" width="64" height="84" rx="4" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#2C2623]" />
      <text x="162" y="44" fill="#2E6B56" fontSize="7.5" fontFamily="monospace" fontWeight="700">Rubric</text>
      <line x1="162" y1="60" x2="212" y2="60" stroke="#AEAC78" strokeWidth="3" />
      <circle cx="198" cy="60" r="4" fill="#2E6B56" />
      <line x1="162" y1="78" x2="212" y2="78" stroke="#AEAC78" strokeWidth="3" />
      <circle cx="204" cy="78" r="4" fill="#F2C46A" />
    </g>

    <path d="M254 80 L288 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 3" />
    <polygon points="288,75 298,80 288,85" fill="#4C4541" />

    {/* Center: Human Sign-Off & Override Audit Stamp */}
    <g transform="translate(304, 18)">
      <rect width="172" height="124" rx="8" fill="#FCF0DA" stroke="#F2C46A" strokeWidth="1.5" className="dark:fill-[#38322E]" />
      <rect width="172" height="24" rx="8" fill="#F2C46A" fillOpacity="0.4" />
      <text x="12" y="16" fill="#4C4541" fontSize="9.5" fontFamily="monospace" fontWeight="700">HUMAN AUTHORITY GATE</text>
      <circle cx="86" cy="62" r="22" fill="#2E6B56" fillOpacity="0.15" stroke="#2E6B56" strokeWidth="1.5" />
      <path d="M76 62 L83 69 L97 55" stroke="#2E6B56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="24" y="102" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8.5" fontFamily="sans-serif" fontWeight="700">Confirm Grade &amp; Sign Off</text>
      <text x="28" y="114" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="7.5" fontFamily="monospace">Immutable audit log saved</text>
    </g>

    <path d="M482 80 L512 80" stroke="#2E6B56" strokeWidth="2" strokeDasharray="4 3" />
    <polygon points="512,75 522,80 512,85" fill="#2E6B56" />

    {/* Right: Gradebook CSV Export */}
    <g transform="translate(528, 18)">
      <rect width="134" height="124" rx="8" fill="#FFFDF9" stroke="#2E6B56" strokeWidth="1.2" className="dark:fill-[#38322E]" />
      <rect width="134" height="24" rx="8" fill="#2E6B56" fillOpacity="0.2" />
      <text x="10" y="16" fill="#2E6B56" fontSize="9.5" fontFamily="monospace" fontWeight="700">LMS CSV EXPORT</text>
      <text x="10" y="42" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="8" fontFamily="monospace">id,score,status</text>
      <text x="10" y="56" fill="#2E6B56" fontSize="8" fontFamily="monospace">1001,92.0,CONFIRMED</text>
      <text x="10" y="70" fill="#2E6B56" fontSize="8" fontFamily="monospace">1002,88.5,CONFIRMED</text>
      <rect x="10" y="88" width="114" height="22" rx="4" fill="#2E6B56" />
      <text x="18" y="102" fill="#FCF0DA" fontSize="8" fontFamily="sans-serif" fontWeight="700">Published to LMS</text>
    </g>
  </svg>
);
