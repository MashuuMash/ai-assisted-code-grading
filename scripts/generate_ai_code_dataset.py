import argparse
import json
from pathlib import Path

DATASET_DIR = Path(__file__).resolve().parent.parent / "data" / "ai_code_dataset"


def build_synthetic_research_dataset() -> list[dict]:
    """Generate a balanced, structured dataset of Python solutions for RQ5 evaluation."""
    dataset = []

    # -------------------------------------------------------------------------
    # Problem 1: Binary Search & Lower Bound
    # -------------------------------------------------------------------------
    # Human 1
    dataset.append({
        "id": "bs_human_01",
        "problem": "binary_search",
        "label": 0,
        "source_type": "human_student",
        "code": (
            "def bsearch(arr, target):\n"
            "    l = 0\n"
            "    r = len(arr) - 1\n"
            "    while l <= r:\n"
            "        m = (l + r) // 2\n"
            "        if arr[m] == target:\n"
            "            return m\n"
            "        elif arr[m] < target:\n"
            "            l = m + 1\n"
            "        else:\n"
            "            r = m - 1\n"
            "    return -1\n"
        )
    })
    # Human 2
    dataset.append({
        "id": "bs_human_02",
        "problem": "binary_search",
        "label": 0,
        "source_type": "human_student",
        "code": (
            "# Binary search with recursive call\n"
            "def search_rec(nums, k, lo, hi):\n"
            "    if lo > hi:\n"
            "        return -1\n"
            "    mid = (lo + hi) // 2\n"
            "    if nums[mid] == k:\n"
            "        return mid\n"
            "    if nums[mid] > k:\n"
            "        return search_rec(nums, k, lo, mid - 1)\n"
            "    return search_rec(nums, k, mid + 1, hi)\n"
        )
    })
    # AI - GPT-4o style
    dataset.append({
        "id": "bs_ai_gpt4o_01",
        "problem": "binary_search",
        "label": 1,
        "source_type": "ai_gpt4o",
        "prompt_style": "zero_shot_typed",
        "code": (
            "from typing import List, Optional\n\n"
            "def binary_search(elements: List[int], target: int) -> Optional[int]:\n"
            "    \"\"\"\n"
            "    Perform binary search on a sorted integer list.\n"
            "    \n"
            "    :param elements: Sorted list of integers.\n"
            "    :param target: Value to search for.\n"
            "    :return: Index of the target if found, otherwise None.\n"
            "    \"\"\"\n"
            "    left_idx: int = 0\n"
            "    right_idx: int = len(elements) - 1\n"
            "    while left_idx <= right_idx:\n"
            "        mid_idx: int = left_idx + (right_idx - left_idx) // 2\n"
            "        if elements[mid_idx] == target:\n"
            "            return mid_idx\n"
            "        if elements[mid_idx] < target:\n"
            "            left_idx = mid_idx + 1\n"
            "        else:\n"
            "            right_idx = mid_idx - 1\n"
            "    return None\n"
        )
    })
    # AI - Claude style
    dataset.append({
        "id": "bs_ai_claude_01",
        "problem": "binary_search",
        "label": 1,
        "source_type": "ai_claude35",
        "prompt_style": "step_by_step",
        "code": (
            "def find_target_index(sorted_sequence: list[int], target_value: int) -> int:\n"
            "    \"\"\"Finds the index of target_value in a sorted sequence using binary search.\"\"\"\n"
            "    low_boundary = 0\n"
            "    high_boundary = len(sorted_sequence) - 1\n"
            "    while low_boundary <= high_boundary:\n"
            "        midpoint = (low_boundary + high_boundary) // 2\n"
            "        current_value = sorted_sequence[midpoint]\n"
            "        if current_value == target_value:\n"
            "            return midpoint\n"
            "        elif current_value < target_value:\n"
            "            low_boundary = midpoint + 1\n"
            "        else:\n"
            "            high_boundary = midpoint - 1\n"
            "    return -1\n"
        )
    })
    # Perturbation (AI with identifier renaming & stripped docstrings)
    dataset.append({
        "id": "bs_perturbed_01",
        "problem": "binary_search",
        "label": 1,
        "source_type": "ai_perturbed",
        "perturbation": "identifier_renaming",
        "code": (
            "def fn(lst, val):\n"
            "    a = 0\n"
            "    b = len(lst) - 1\n"
            "    while a <= b:\n"
            "        c = (a + b) // 2\n"
            "        if lst[c] == val:\n"
            "            return c\n"
            "        if lst[c] < val:\n"
            "            a = c + 1\n"
            "        else:\n"
            "            b = c - 1\n"
            "    return -1\n"
        )
    })

    # -------------------------------------------------------------------------
    # Problem 2: Dynamic Programming (0/1 Knapsack)
    # -------------------------------------------------------------------------
    # Human
    dataset.append({
        "id": "ks_human_01",
        "problem": "knapsack",
        "label": 0,
        "source_type": "human_student",
        "code": (
            "def knap(W, wt, val, n):\n"
            "    # dp table\n"
            "    dp = [[0 for _ in range(W + 1)] for _ in range(n + 1)]\n"
            "    for i in range(1, n + 1):\n"
            "        for w in range(1, W + 1):\n"
            "            if wt[i - 1] <= w:\n"
            "                dp[i][w] = max(val[i - 1] + dp[i - 1][w - wt[i - 1]], dp[i - 1][w])\n"
            "            else:\n"
            "                dp[i][w] = dp[i - 1][w]\n"
            "    return dp[n][W]\n"
        )
    })
    # AI - Gemini style
    dataset.append({
        "id": "ks_ai_gemini_01",
        "problem": "knapsack",
        "label": 1,
        "source_type": "ai_gemini25",
        "prompt_style": "concise_typed",
        "code": (
            "def solve_knapsack(capacity: int, weights: list[int], values: list[int]) -> int:\n"
            "    \"\"\"Solves the 0/1 Knapsack problem using dynamic programming.\"\"\"\n"
            "    num_items = len(weights)\n"
            "    dp_table = [0] * (capacity + 1)\n"
            "    for item_idx in range(num_items):\n"
            "        curr_weight = weights[item_idx]\n"
            "        curr_value = values[item_idx]\n"
            "        for cap in range(capacity, curr_weight - 1, -1):\n"
            "            dp_table[cap] = max(dp_table[cap], dp_table[cap - curr_weight] + curr_value)\n"
            "    return dp_table[capacity]\n"
        )
    })
    # AI - GPT-4o
    dataset.append({
        "id": "ks_ai_gpt4o_01",
        "problem": "knapsack",
        "label": 1,
        "source_type": "ai_gpt4o",
        "prompt_style": "zero_shot_typed",
        "code": (
            "def knapsack_01(max_weight: int, item_weights: list[int], item_values: list[int]) -> int:\n"
            "    \"\"\"\n"
            "    Calculate maximum value obtainable within weight constraint.\n"
            "    \"\"\"\n"
            "    item_count = len(item_weights)\n"
            "    memoization_matrix = [[0] * (max_weight + 1) for _ in range(item_count + 1)]\n"
            "    for i in range(1, item_count + 1):\n"
            "        for w in range(1, max_weight + 1):\n"
            "            if item_weights[i - 1] <= w:\n"
            "                memoization_matrix[i][w] = max(\n"
            "                    item_values[i - 1] + memoization_matrix[i - 1][w - item_weights[i - 1]],\n"
            "                    memoization_matrix[i - 1][w]\n"
            "                )\n"
            "            else:\n"
            "                memoization_matrix[i][w] = memoization_matrix[i - 1][w]\n"
            "    return memoization_matrix[item_count][max_weight]\n"
        )
    })
    # Perturbed
    dataset.append({
        "id": "ks_perturbed_01",
        "problem": "knapsack",
        "label": 1,
        "source_type": "ai_perturbed",
        "perturbation": "loop_transform",
        "code": (
            "def knap_solve(cap, wts, vals):\n"
            "    t = [0] * (cap + 1)\n"
            "    i = 0\n"
            "    while i < len(wts):\n"
            "        w = cap\n"
            "        while w >= wts[i]:\n"
            "            if t[w - wts[i]] + vals[i] > t[w]:\n"
            "                t[w] = t[w - wts[i]] + vals[i]\n"
            "            w -= 1\n"
            "        i += 1\n"
            "    return t[cap]\n"
        )
    })

    # -------------------------------------------------------------------------
    # Problem 3: Graph Traversal (DFS Connected Components)
    # -------------------------------------------------------------------------
    # Human
    dataset.append({
        "id": "dfs_human_01",
        "problem": "graph_dfs",
        "label": 0,
        "source_type": "human_student",
        "code": (
            "def count_components(n, edges):\n"
            "    adj = {i: [] for i in range(n)}\n"
            "    for u, v in edges:\n"
            "        adj[u].append(v)\n"
            "        adj[v].append(u)\n"
            "    visited = set()\n"
            "    count = 0\n"
            "    def dfs(node):\n"
            "        visited.add(node)\n"
            "        for neighbor in adj[node]:\n"
            "            if neighbor not in visited:\n"
            "                dfs(neighbor)\n"
            "    for i in range(n):\n"
            "        if i not in visited:\n"
            "            dfs(i)\n"
            "            count += 1\n"
            "    return count\n"
        )
    })
    # AI - Claude
    dataset.append({
        "id": "dfs_ai_claude_01",
        "problem": "graph_dfs",
        "label": 1,
        "source_type": "ai_claude35",
        "prompt_style": "step_by_step",
        "code": (
            "from collections import defaultdict\n\n"
            "def find_connected_components(vertex_count: int, edge_pairs: list[tuple[int, int]]) -> int:\n"
            "    \"\"\"\n"
            "    Calculates the number of connected components in an undirected graph.\n"
            "    \"\"\"\n"
            "    graph_adjacency: dict[int, list[int]] = defaultdict(list)\n"
            "    for start_vertex, end_vertex in edge_pairs:\n"
            "        graph_adjacency[start_vertex].append(end_vertex)\n"
            "        graph_adjacency[end_vertex].append(end_vertex)\n"
            "    explored_nodes: set[int] = set()\n"
            "    component_tally: int = 0\n"
            "    for current_vertex in range(vertex_count):\n"
            "        if current_vertex not in explored_nodes:\n"
            "            component_tally += 1\n"
            "            exploration_stack = [current_vertex]\n"
            "            while exploration_stack:\n"
            "                active_node = exploration_stack.pop()\n"
            "                if active_node not in explored_nodes:\n"
            "                    explored_nodes.add(active_node)\n"
            "                    exploration_stack.extend(graph_adjacency[active_node])\n"
            "    return component_tally\n"
        )
    })

    return dataset


def main():
    parser = argparse.ArgumentParser(description="Generate benchmark dataset for CodeBERT evaluation")
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(DATASET_DIR),
        help="Target directory to save the generated dataset",
    )
    args = parser.parse_args()

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    dataset = build_synthetic_research_dataset()
    out_file = out_dir / "dataset.json"

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)

    print(f"Generated {len(dataset)} samples for CodeBERT evaluation.")
    print(f"Dataset saved to: {out_file.resolve()}")


if __name__ == "__main__":
    main()
