from app.similarity.engine import compute_similarity, tokenize_and_normalize

def test_similarity_renamed_variables():
    code_a = """
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                temp = arr[j]
                arr[j] = arr[j + 1]
                arr[j + 1] = temp
    return arr
"""

    code_b = """
# Renamed variables and slight spacing differences
def sort_items(elements):
    total = len(elements)
    for idx_a in range(total):
        for idx_b in range(0, total - idx_a - 1):
            if elements[idx_b] > elements[idx_b + 1]:
                val = elements[idx_b]
                elements[idx_b] = elements[idx_b + 1]
                elements[idx_b + 1] = val
    return elements
"""

    score, matched_spans = compute_similarity(code_a, code_b)
    # Since tokens are normalized, identical logic with renamed variables must have very high similarity
    assert score >= 0.70
    assert len(matched_spans) > 0

def test_similarity_completely_different_code():
    code_a = """
def compute_area(radius):
    import math
    return math.pi * radius * radius
"""
    code_b = """
def count_vowels(text):
    count = 0
    for char in text:
        if char in "aeiouAEIOU":
            count += 1
    return count
"""
    score, _ = compute_similarity(code_a, code_b)
    assert score <= 0.30
