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
// ============================================================================

export const Stage1IngestDiagram: React.FC = () => (
  <svg data-testid="pipeline-diagram-svg" viewBox="0 0 680 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
    <rect width="680" height="160" rx="10" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#2C2623]" />
    {/* Stage Step 1 */}
    <g transform="translate(20, 25)">
      <rect width="180" height="110" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="180" height="24" rx="8" fill="#AEAC78" fillOpacity="0.2" />
      <text x="12" y="16" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="10" fontFamily="monospace" fontWeight="700">1. LMS ZIP ARCHIVE</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">Moodle / Canvas Export</text>
      <text x="12" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">submissions_batch.zip</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Student IDs &amp; Timestamps</text>
      <rect x="12" y="86" width="130" height="16" rx="3" fill="#F2C46A" fillOpacity="0.4" />
      <text x="16" y="98" fill="#4C4541" fontSize="8" fontFamily="sans-serif" fontWeight="700">Multi-File Manifest</text>
    </g>

    {/* Transition 1 */}
    <path d="M210 80 L245 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 4" />
    <polygon points="245,76 253,80 245,84" fill="#AEAC78" />

    {/* Step 2 */}
    <g transform="translate(260, 25)">
      <rect width="180" height="110" rx="8" fill="#FCF0DA" stroke="#8F3D2C" strokeWidth="1.2" className="dark:fill-[#38322E]" />
      <rect width="180" height="24" rx="8" fill="#8F3D2C" fillOpacity="0.15" />
      <text x="12" y="16" fill="#8F3D2C" fontSize="10" fontFamily="monospace" fontWeight="700">2. TRAVERSAL SANITIZER</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">Zip-Slip Vulnerability Guard</text>
      <text x="12" y="60" fill="#8F3D2C" fontSize="8" fontFamily="monospace">Blocks ../ path escapes</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">UTF-8 Normalization</text>
      <rect x="12" y="86" width="130" height="16" rx="3" fill="#2E6B56" fillOpacity="0.2" />
      <text x="16" y="98" fill="#2E6B56" fontSize="8" fontFamily="sans-serif" fontWeight="700">Safe Extracted Files</text>
    </g>

    {/* Transition 2 */}
    <path d="M450 80 L485 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 4" />
    <polygon points="485,76 493,80 485,84" fill="#AEAC78" />

    {/* Step 3 */}
    <g transform="translate(500, 25)">
      <rect width="160" height="110" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="160" height="24" rx="8" fill="#2E6B56" fillOpacity="0.2" />
      <text x="12" y="16" fill="#2E6B56" fontSize="10" fontFamily="monospace" fontWeight="700">3. PARSED MANIFEST</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">SHA-256 Checksum Index</text>
      <text x="12" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">idempotent_hash: a8f4...</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Ready for Sandbox Queue</text>
      <rect x="12" y="86" width="120" height="16" rx="3" fill="#2E6B56" fillOpacity="0.2" />
      <text x="16" y="98" fill="#2E6B56" fontSize="8" fontFamily="sans-serif" fontWeight="700">Database Registered</text>
    </g>
  </svg>
);

export const Stage2SandboxDiagram: React.FC = () => (
  <svg data-testid="pipeline-diagram-svg" viewBox="0 0 680 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
    <rect width="680" height="160" rx="10" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#2C2623]" />
    {/* Stage Step 1 */}
    <g transform="translate(20, 25)">
      <rect width="180" height="110" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="180" height="24" rx="8" fill="#F2C46A" fillOpacity="0.3" />
      <text x="12" y="16" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="10" fontFamily="monospace" fontWeight="700">1. CONTAINER SPAWN</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">Alpine 3.19 Linux Sandbox</text>
      <text x="12" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">cgroups: 256MB memory</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">1 vCPU CPU-quota limit</text>
      <rect x="12" y="86" width="130" height="16" rx="3" fill="#2E6B56" fillOpacity="0.2" />
      <text x="16" y="98" fill="#2E6B56" fontSize="8" fontFamily="sans-serif" fontWeight="700">Sub-second Startup</text>
    </g>

    {/* Transition 1 */}
    <path d="M210 80 L245 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 4" />
    <polygon points="245,76 253,80 245,84" fill="#AEAC78" />

    {/* Step 2 */}
    <g transform="translate(260, 25)">
      <rect width="180" height="110" rx="8" fill="#FCF0DA" stroke="#8F3D2C" strokeWidth="1.2" className="dark:fill-[#38322E]" />
      <rect width="180" height="24" rx="8" fill="#8F3D2C" fillOpacity="0.15" />
      <text x="12" y="16" fill="#8F3D2C" fontSize="10" fontFamily="monospace" fontWeight="700">2. ZERO NETWORK WALL</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">--network none</text>
      <text x="12" y="60" fill="#8F3D2C" fontSize="8" fontFamily="sans-serif">No outbound HTTP / sockets</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Read-only code mount</text>
      <rect x="12" y="86" width="130" height="16" rx="3" fill="#8F3D2C" fillOpacity="0.2" />
      <text x="16" y="98" fill="#8F3D2C" fontSize="8" fontFamily="sans-serif" fontWeight="700">Air-Gapped Isolation</text>
    </g>

    {/* Transition 2 */}
    <path d="M450 80 L485 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 4" />
    <polygon points="485,76 493,80 485,84" fill="#AEAC78" />

    {/* Step 3 */}
    <g transform="translate(500, 25)">
      <rect width="160" height="110" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="160" height="24" rx="8" fill="#2E6B56" fillOpacity="0.2" />
      <text x="12" y="16" fill="#2E6B56" fontSize="10" fontFamily="monospace" fontWeight="700">3. PYTEST PLUGIN</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">In-Container Test Runner</text>
      <text x="12" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">10s SIGKILL watchdog</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Structured JSON results</text>
      <rect x="12" y="86" width="120" height="16" rx="3" fill="#2E6B56" fillOpacity="0.2" />
      <text x="16" y="98" fill="#2E6B56" fontSize="8" fontFamily="sans-serif" fontWeight="700">Traceback Captured</text>
    </g>
  </svg>
);

export const Stage3EvidenceDiagram: React.FC = () => (
  <svg data-testid="pipeline-diagram-svg" viewBox="0 0 680 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
    <rect width="680" height="160" rx="10" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#2C2623]" />
    {/* Stage Step 1 */}
    <g transform="translate(20, 25)">
      <rect width="180" height="110" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="180" height="24" rx="8" fill="#AEAC78" fillOpacity="0.2" />
      <text x="12" y="16" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="10" fontFamily="monospace" fontWeight="700">1. RUFF STATIC LINTER</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">PEP-8 &amp; Code Quality</text>
      <text x="12" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">Line number mapping</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Syntax &amp; Style Diagnostics</text>
      <rect x="12" y="86" width="130" height="16" rx="3" fill="#F2C46A" fillOpacity="0.4" />
      <text x="16" y="98" fill="#4C4541" fontSize="8" fontFamily="sans-serif" fontWeight="700">EVID_LINT_* Created</text>
    </g>

    {/* Transition 1 */}
    <path d="M210 80 L245 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 4" />
    <polygon points="245,76 253,80 245,84" fill="#AEAC78" />

    {/* Step 2 */}
    <g transform="translate(260, 25)">
      <rect width="180" height="110" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="180" height="24" rx="8" fill="#AEAC78" fillOpacity="0.25" />
      <text x="12" y="16" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="10" fontFamily="monospace" fontWeight="700">2. MCCABE AST PARSER</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">Cyclomatic Complexity</text>
      <text x="12" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">Control flow branch count</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Function-level scoring</text>
      <rect x="12" y="86" width="130" height="16" rx="3" fill="#AEAC78" fillOpacity="0.3" />
      <text x="16" y="98" fill="#4C4541" fontSize="8" fontFamily="sans-serif" fontWeight="700">EVID_AST_* Created</text>
    </g>

    {/* Transition 2 */}
    <path d="M450 80 L485 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 4" />
    <polygon points="485,76 493,80 485,84" fill="#AEAC78" />

    {/* Step 3 */}
    <g transform="translate(500, 25)">
      <rect width="160" height="110" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="160" height="24" rx="8" fill="#2E6B56" fillOpacity="0.2" />
      <text x="12" y="16" fill="#2E6B56" fontSize="10" fontFamily="monospace" fontWeight="700">3. TOKEN WINNOWING</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">Karp-Rabin Hash Windows</text>
      <text x="12" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Base code subtracted</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Pairwise cluster analysis</text>
      <rect x="12" y="86" width="120" height="16" rx="3" fill="#2E6B56" fillOpacity="0.2" />
      <text x="16" y="98" fill="#2E6B56" fontSize="8" fontFamily="sans-serif" fontWeight="700">Similarity Fingerprint</text>
    </g>
  </svg>
);

export const Stage4AiDraftDiagram: React.FC = () => (
  <svg data-testid="pipeline-diagram-svg" viewBox="0 0 680 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
    <rect width="680" height="160" rx="10" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#2C2623]" />
    {/* Stage Step 1 */}
    <g transform="translate(20, 25)">
      <rect width="180" height="110" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="180" height="24" rx="8" fill="#AEAC78" fillOpacity="0.2" />
      <text x="12" y="16" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="10" fontFamily="monospace" fontWeight="700">1. EVIDENCE BINDING</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">Inject Verified Tokens</text>
      <text x="12" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">EVID_TEST_* + EVID_LINT_*</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Rubric criterion weights</text>
      <rect x="12" y="86" width="130" height="16" rx="3" fill="#F2C46A" fillOpacity="0.4" />
      <text x="16" y="98" fill="#4C4541" fontSize="8" fontFamily="sans-serif" fontWeight="700">Strict Anchor Context</text>
    </g>

    {/* Transition 1 */}
    <path d="M210 80 L245 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 4" />
    <polygon points="245,76 253,80 245,84" fill="#AEAC78" />

    {/* Step 2 */}
    <g transform="translate(260, 25)">
      <rect width="180" height="110" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="180" height="24" rx="8" fill="#F2C46A" fillOpacity="0.3" />
      <text x="12" y="16" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="10" fontFamily="monospace" fontWeight="700">2. SYNTHESIS ENGINE</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">Google Gemini / GPT-4o</text>
      <text x="12" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Mandatory citation tags</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Rule-based offline fallback</text>
      <rect x="12" y="86" width="130" height="16" rx="3" fill="#2E6B56" fillOpacity="0.2" />
      <text x="16" y="98" fill="#2E6B56" fontSize="8" fontFamily="sans-serif" fontWeight="700">Hallucination Blocked</text>
    </g>

    {/* Transition 2 */}
    <path d="M450 80 L485 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 4" />
    <polygon points="485,76 493,80 485,84" fill="#AEAC78" />

    {/* Step 3 */}
    <g transform="translate(500, 25)">
      <rect width="160" height="110" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="160" height="24" rx="8" fill="#2E6B56" fillOpacity="0.2" />
      <text x="12" y="16" fill="#2E6B56" fontSize="10" fontFamily="monospace" fontWeight="700">3. DRAFT MARKDOWN</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">Pedagogical Advice</text>
      <text x="12" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Pending instructor review</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Status: Unconfirmed</text>
      <rect x="12" y="86" width="120" height="16" rx="3" fill="#F2C46A" fillOpacity="0.4" />
      <text x="16" y="98" fill="#4C4541" fontSize="8" fontFamily="sans-serif" fontWeight="700">Editable by Lecturer</text>
    </g>
  </svg>
);

export const Stage5ReviewDiagram: React.FC = () => (
  <svg data-testid="pipeline-diagram-svg" viewBox="0 0 680 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
    <rect width="680" height="160" rx="10" fill="#FFFDF9" stroke="#AEAC78" strokeWidth="1.5" className="dark:fill-[#2C2623]" />
    {/* Stage Step 1 */}
    <g transform="translate(20, 25)">
      <rect width="180" height="110" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="180" height="24" rx="8" fill="#AEAC78" fillOpacity="0.2" />
      <text x="12" y="16" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="10" fontFamily="monospace" fontWeight="700">1. LECTURER WORKSTATION</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">Side-by-Side Review</text>
      <text x="12" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Inspect test traces &amp; code</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Verify AI citations</text>
      <rect x="12" y="86" width="130" height="16" rx="3" fill="#F2C46A" fillOpacity="0.4" />
      <text x="16" y="98" fill="#4C4541" fontSize="8" fontFamily="sans-serif" fontWeight="700">Direct Inspector View</text>
    </g>

    {/* Transition 1 */}
    <path d="M210 80 L245 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 4" />
    <polygon points="245,76 253,80 245,84" fill="#AEAC78" />

    {/* Step 2 */}
    <g transform="translate(260, 25)">
      <rect width="180" height="110" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="180" height="24" rx="8" fill="#F2C46A" fillOpacity="0.3" />
      <text x="12" y="16" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="10" fontFamily="monospace" fontWeight="700">2. GRADE OVERRIDES</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">Interactive Score Sliders</text>
      <text x="12" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Manual criterion adjustments</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Reason note audit trail</text>
      <rect x="12" y="86" width="130" height="16" rx="3" fill="#AEAC78" fillOpacity="0.3" />
      <text x="16" y="98" fill="#4C4541" fontSize="8" fontFamily="sans-serif" fontWeight="700">Audit Trail Logged</text>
    </g>

    {/* Transition 2 */}
    <path d="M450 80 L485 80" stroke="#AEAC78" strokeWidth="2" strokeDasharray="4 4" />
    <polygon points="485,76 493,80 485,84" fill="#AEAC78" />

    {/* Step 3 */}
    <g transform="translate(500, 25)">
      <rect width="160" height="110" rx="8" fill="#FCF0DA" stroke="#AEAC78" strokeWidth="1" className="dark:fill-[#38322E]" />
      <rect width="160" height="24" rx="8" fill="#2E6B56" fillOpacity="0.2" />
      <text x="12" y="16" fill="#2E6B56" fontSize="10" fontFamily="monospace" fontWeight="700">3. PUBLISH &amp; LMS EXPORT</text>
      <text x="12" y="44" fill="#4C4541" className="dark:fill-[#FCF0DA]" fontSize="9" fontFamily="sans-serif">Final Examiner Signature</text>
      <text x="12" y="60" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="sans-serif">Status: Confirmed</text>
      <text x="12" y="76" fill="#6B625B" className="dark:fill-[#AEAC78]" fontSize="8" fontFamily="monospace">gradebook_export.csv</text>
      <rect x="12" y="86" width="120" height="16" rx="3" fill="#2E6B56" fillOpacity="0.2" />
      <text x="16" y="98" fill="#2E6B56" fontSize="8" fontFamily="sans-serif" fontWeight="700">LMS Synchronized</text>
    </g>
  </svg>
);
