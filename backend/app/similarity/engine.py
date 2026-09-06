import hashlib
import io
import token
import tokenize
from decimal import Decimal
from typing import Any, Dict, List, Set, Tuple

K_GRAM_SIZE = 8
WINDOW_SIZE = 5

class TokenItem:
    __slots__ = ("type_name", "normalized_val", "lineno", "col")
    def __init__(self, type_name: str, normalized_val: str, lineno: int, col: int):
        self.type_name = type_name
        self.normalized_val = normalized_val
        self.lineno = lineno
        self.col = col

def tokenize_and_normalize(source_code: str) -> List[TokenItem]:
    """
    Tokenizes Python source code, strips comments, and normalizes identifiers and literals.
    """
    tokens: List[TokenItem] = []
    
    try:
        reader = io.StringIO(source_code).readline
        for tok in tokenize.generate_tokens(reader):
            tok_type = tok.type
            tok_val = tok.string
            start_line, start_col = tok.start

            # Skip comments and unnecessary whitespace
            if tok_type in (tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT):
                continue
            if tok_type == token.ENDMARKER:
                break

            # Normalize identifiers (variables, functions, attributes)
            if tok_type == token.NAME:
                # Keep control keywords distinct
                import keyword
                if keyword.iskeyword(tok_val):
                    normalized = tok_val
                else:
                    normalized = "ID"
            elif tok_type == token.NUMBER:
                normalized = "NUM"
            elif tok_type == token.STRING:
                normalized = "STR"
            else:
                normalized = tok_val

            tokens.append(TokenItem(
                type_name=token.tok_name.get(tok_type, "OP"),
                normalized_val=normalized,
                lineno=start_line,
                col=start_col,
            ))
    except Exception:
        # Fallback to simple split if tokenize fails on syntax errors
        for idx, word in enumerate(source_code.split()):
            tokens.append(TokenItem("FALLBACK", word, idx + 1, 0))

    return tokens

def compute_kgram_hashes(tokens: List[TokenItem], k: int = K_GRAM_SIZE) -> List[Tuple[int, int, int]]:
    """
    Generates K-grams and computes hashes.
    Returns list of (hash_val, start_line, end_line).
    """
    hashes = []
    if len(tokens) < k:
        return hashes

    for i in range(len(tokens) - k + 1):
        kgram = "_".join(t.normalized_val for t in tokens[i:i + k])
        h = int(hashlib.md5(kgram.encode("utf-8")).hexdigest()[:8], 16)
        start_line = tokens[i].lineno
        end_line = tokens[i + k - 1].lineno
        hashes.append((h, start_line, end_line))

    return hashes

def winnow(kgram_hashes: List[Tuple[int, int, int]], w: int = WINDOW_SIZE) -> List[Tuple[int, int, int]]:
    """
    Winnowing algorithm: selects minimum hash in each sliding window of size w.
    """
    fingerprints = []
    if not kgram_hashes:
        return fingerprints

    if len(kgram_hashes) < w:
        min_item = min(kgram_hashes, key=lambda x: x[0])
        return [min_item]

    min_idx = -1
    for i in range(len(kgram_hashes) - w + 1):
        window = kgram_hashes[i:i + w]
        # Find rightmost minimum in the window
        cur_min = min(window, key=lambda x: x[0])
        cur_min_idx = i + window.index(cur_min)
        if cur_min_idx != min_idx:
            fingerprints.append(cur_min)
            min_idx = cur_min_idx

    return fingerprints

def compute_similarity(
    source_a: str,
    source_b: str,
) -> Tuple[Decimal, List[Dict[str, Any]]]:
    """
    Computes Jaccard similarity between two code submissions using Winnowing fingerprints
    and returns similarity score (0.0 to 1.0) and aligned matched line spans.
    """
    tokens_a = tokenize_and_normalize(source_a)
    tokens_b = tokenize_and_normalize(source_b)

    if not tokens_a or not tokens_b:
        return Decimal("0.0000"), []

    hashes_a = compute_kgram_hashes(tokens_a)
    hashes_b = compute_kgram_hashes(tokens_b)

    fp_a = winnow(hashes_a)
    fp_b = winnow(hashes_b)

    if not fp_a or not fp_b:
        return Decimal("0.0000"), []

    set_a = {h for h, _, _ in fp_a}
    set_b = {h for h, _, _ in fp_b}

    intersection = set_a.intersection(set_b)
    union = set_a.union(set_b)

    if not union:
        return Decimal("0.0000"), []

    score = Decimal(str(round(len(intersection) / len(union), 4)))

    # Identify matched line spans
    matched_spans = []
    lookup_b = {}
    for h, s_b, e_b in fp_b:
        if h not in lookup_b:
            lookup_b[h] = []
        lookup_b[h].append((s_b, e_b))

    for h, s_a, e_a in fp_a:
        if h in lookup_b:
            for s_b, e_b in lookup_b[h]:
                matched_spans.append({
                    "a_lines": [s_a, e_a],
                    "b_lines": [s_b, e_b],
                })

    # Deduplicate overlapping spans
    clean_spans = []
    seen = set()
    for span in matched_spans:
        key = (span["a_lines"][0], span["a_lines"][1], span["b_lines"][0], span["b_lines"][1])
        if key not in seen:
            seen.add(key)
            clean_spans.append(span)

    return score, clean_spans[:20]  # Cap top 20 matched regions
