# DSA Strategic Roadmap & Atomic Query Catalog
> **Target**: SDE-2 / Senior Backend Engineer at Tier-1 Product Companies (PhonePe, Swiggy, Razorpay, Uber, Atlassian, CRED, Zepto)  
> **Timeline**: 6-Month Intensive Substrate  
> **Repository**: [github.com/harshansarvaiya/DSA](https://github.com/harshansarvaiya/DSA)  
> **System Design Sister Repo**: [github.com/harshansarvaiya/SystemDesign](https://github.com/harshansarvaiya/SystemDesign)

---

## 1. Core Philosophy: High-ROI Pattern Mastery & The Senior SDE-2 Bar

* **No Random LeetCode Browsing**: Solve only high-yield canonical patterns and problem variations that reflect real Tier-1 senior evaluation bars.
* **The Senior SDE-2 Evaluation Bar**:
  * **Pattern Recognition**: Identify the optimal algorithmic pattern within 2–3 minutes of reading the problem statement.
  * **Zero Compiler Reliance**: Write bug-free, idiomatic Java implementation on a blank whiteboard or simple editor within 20–25 minutes.
  * **Upfront Complexity Defense**: Articulate exact Big-$O$ time and space complexity and memory trade-offs before writing a single line of code.
* **Java Memory & Runtime Awareness**:
  * **Eliminate Autoboxing Overhead**: Strongly prefer primitive arrays (`int[]`, `long[]`) over boxed generic collections (`List<Integer>`, `Map<Integer, Integer>`) to avoid 16-byte object headers and garbage collector churn in tight loops.
  * **Queue & Stack Selection**: Always favor `ArrayDeque` over `LinkedList` or legacy `Stack`. `ArrayDeque` guarantees contiguous memory locality and avoids per-node object allocation overhead.
  * **Sorting Realities**: `Arrays.sort(primitive[])` uses Dual-Pivot Quicksort ($O(N^2)$ worst-case), whereas `Arrays.sort(Object[])` uses Timsort ($O(N \log N)$ guaranteed).

---

## 2. Topic Triage & ROI Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 1: Non-Negotiable Core (~70% of Coding Rounds)                    │
│ Two Pointers │ Sliding Window │ Prefix Sum │ Intervals │ Monotonic     │
│ Stack │ Top-K Heaps │ Tree/Grid Traversals │ Topological Sort │ DSU    │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 2: Calibrated Depth (Standard Templates Only)                     │
│ Binary Search on Answer Space │ 1D/2D DP │ String DP │ Trie │ Backtracking│
├────────────────────────────────────────────────────────────────────────┤
│ Tier 3: Deprioritized Traps (Low ROI for Senior Backend)               │
│ Bit Manipulation tricks │ Complex Dijkstra Puzzles │ In-Place Linked List│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Atomic Topic Catalog (Copy-Paste Query Ready)

### Phase 1: Linear Sequences & Contiguous Windows

#### 01. Two Pointers (Bidirectional & Fast/Slow)
* **`🔍 Search String`**: `Two pointers technique Java sorted arrays bidirectional fast slow pointer`
* **Core Concepts**: Sorted array inward convergence, cycle detection via Floyd's algorithm, in-place element swapping without auxiliary storage.
* **Canonical Problems**:
  * *3Sum* (LeetCode 15)
  * *Container With Most Water* (LeetCode 11)
  * *Trapping Rain Water* (LeetCode 42)
* **Java Optimization**: Avoid nested loops; manage pointer boundaries with strict while-condition `left < right`.

#### 02. Sliding Window (Fixed & Dynamic Window Boundaries)
* **`🔍 Search String`**: `Sliding window pattern Java fixed dynamic window boundary frequency map`
* **Core Concepts**: Contiguous subarray/substring tracking, expanding right pointer to satisfy invariant, shrinking left pointer to restore validity, maintaining window state in $O(1)$.
* **Canonical Problems**:
  * *Longest Substring Without Repeating Characters* (LeetCode 3)
  * *Minimum Window Substring* (LeetCode 76)
  * *Sliding Window Maximum* (LeetCode 239)
* **Java Optimization**: Use flat integer array `int[128]` or `int[256]` instead of `HashMap<Character, Integer>` for ASCII character frequencies.

#### 03. Prefix Sum + Hash Table
* **`🔍 Search String`**: `Prefix sum hashmap technique Java subarray sum equals k contiguous array`
* **Core Concepts**: Cumulative sum array $P[i] = P[i-1] + A[i]$, reducing range sum queries to $O(1)$, storing prefix sums in a hash table to find target complement $(P[i] - K)$.
* **Canonical Problems**:
  * *Subarray Sum Equals K* (LeetCode 560)
  * *Continuous Subarray Sum* (LeetCode 523)
  * *Contiguous Array* (LeetCode 525)
* **Java Optimization**: Pre-seed the HashMap with `(0, 1)` or `(0, -1)` to handle subarray matches originating from index 0.

#### 04. Overlapping Intervals & Sweep-Line
* **`🔍 Search String`**: `Merge intervals sweep line algorithm Java comparator meeting rooms`
* **Core Concepts**: Sorting intervals by start time via custom comparator or lambda, merging overlapping bounds ($start_2 \le end_1$), tracking active concurrent events via coordinate sorting.
* **Canonical Problems**:
  * *Merge Intervals* (LeetCode 56)
  * *Insert Interval* (LeetCode 57)
  * *Meeting Rooms II* (LeetCode 253 / LintCode 919)
* **Java Optimization**: Use `Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]))` or a Min-Heap (`PriorityQueue<Integer>`) tracking meeting end times.

#### 05. Monotonic Stack & Deque
* **`🔍 Search String`**: `Monotonic stack pattern Java next greater element histogram sliding window deque`
* **Core Concepts**: Maintaining strictly increasing or decreasing elements inside stack, finding Next Greater / Next Smaller element in $O(N)$ amortized time.
* **Canonical Problems**:
  * *Daily Temperatures* (LeetCode 739)
  * *Next Greater Element II* (LeetCode 503)
  * *Largest Rectangle in Histogram* (LeetCode 84)
* **Java Optimization**: Use `ArrayDeque<Integer>` as stack (`push()`, `pop()`); store indices rather than values to track distance windows.

---

### Phase 2: Trees, Heaps & Composite Structures

#### 06. Binary Tree Traversals & Depth Recursion
* **`🔍 Search String`**: `Binary tree maximum path sum lowest common ancestor Java recursive DFS traversal`
* **Core Concepts**: Pre-order, in-order, post-order DFS traversals, calculating subtree heights and maximum path sums bottom-up, passing state across recursive boundaries.
* **Canonical Problems**:
  * *Lowest Common Ancestor of a Binary Tree* (LeetCode 236)
  * *Binary Tree Maximum Path Sum* (LeetCode 124)
  * *Diameter of Binary Tree* (LeetCode 543)
* **Java Optimization**: Return atomic array `int[]` or custom lightweight record from helper method to bundle multiple return values without global variables.

#### 07. Breadth-First Search (BFS) & Level-Order Traversal
* **`🔍 Search String`**: `Binary tree level order traversal zigzag BFS ArrayDeque Java`
* **Core Concepts**: Queue-based layer-by-layer exploration, tracking level size $S = \text{queue.size()}$ before iterating each generation, shortest path in unweighted graphs.
* **Canonical Problems**:
  * *Binary Tree Level Order Traversal* (LeetCode 102)
  * *Binary Tree Zigzag Level Order Traversal* (LeetCode 103)
  * *Populating Next Right Pointers in Each Node* (LeetCode 116)
* **Java Optimization**: Allocate `ArrayDeque` with expected capacity to eliminate queue resizing overhead.

#### 08. Top-K Elements & Heap / PriorityQueue
* **`🔍 Search String`**: `Top K frequent elements min heap max heap Java PriorityQueue quickselect`
* **Core Concepts**: Maintaining bounded Min-Heap of size $K$ to find top $K$ largest elements in $O(N \log K)$, two-heap pattern for running median tracking.
* **Canonical Problems**:
  * *Kth Largest Element in an Array* (LeetCode 215)
  * *Top K Frequent Elements* (LeetCode 347)
  * *Find Median from Data Stream* (LeetCode 295)
* **Java Optimization**: Use Min-Heap of size $K$ rather than sorting entire array ($O(N \log N)$); prefer QuickSelect for $O(N)$ average time.

#### 09. Composite LRU / LFU Cache Data Structure
* **`🔍 Search String`**: `Design LRU cache doubly linked list hashmap Java O(1) get put`
* **Core Concepts**: Composite data structure combining `HashMap<Key, Node>` for $O(1)$ lookup and custom Doubly Linked List for $O(1)$ eviction and node repositioning.
* **Canonical Problems**:
  * *LRU Cache* (LeetCode 146)
  * *LFU Cache* (LeetCode 460)
* **Java Optimization**: Implement lightweight inner class `Node` with dummy `head` and `tail` sentinels to eliminate null-check edge cases.

---

### Phase 3: Graphs & Search Space

#### 10. Matrix Grid Traversals (BFS / DFS / Flood Fill)
* **`🔍 Search String`**: `Number of islands matrix BFS DFS flood fill direction array Java`
* **Core Concepts**: Grid representation as 2D array, directional arrays `int[][] DIRS = {{-1,0},{1,0},{0,-1},{0,1}}`, boundary checks, tracking visited cells via in-place mutation or boolean matrix.
* **Canonical Problems**:
  * *Number of Islands* (LeetCode 200)
  * *Max Area of Island* (LeetCode 695)
  * *Rotting Oranges* (LeetCode 994)
* **Java Optimization**: Multi-source BFS using `ArrayDeque<int[]>` for distance propagation.

#### 11. Topological Sort (Kahn's Algorithm & Dependency Resolution)
* **`🔍 Search String`**: `Topological sort Kahns algorithm indegree array cycle detection Java`
* **Core Concepts**: Directed Acyclic Graph (DAG) ordering, in-degree calculation array, queue-based resolution of 0-indegree nodes, cycle detection when processed count $< N$.
* **Canonical Problems**:
  * *Course Schedule I* (LeetCode 207)
  * *Course Schedule II* (LeetCode 210)
  * *Alien Dictionary* (LeetCode 269 / LintCode 892)
* **Java Optimization**: Use `List<Integer>[]` adjacency array instead of `Map<Integer, List<Integer>>` for index-based graphs.

#### 12. Disjoint Set Union (DSU / Union-Find)
* **`🔍 Search String`**: `Disjoint set union DSU path compression union by rank Java`
* **Core Concepts**: Dynamic connectivity, representative root finding with **Path Compression** ($find(x)$), merging components with **Union by Rank / Size**, achieving near-$O(1)$ amortized time ($\alpha(N)$ Ackermann inverse).
* **Canonical Problems**:
  * *Number of Provinces* (LeetCode 547)
  * *Redundant Connection* (LeetCode 684)
  * *Accounts Merge* (LeetCode 721)
* **Java Optimization**: Flat `int[] parent` and `int[] rank` arrays; flatten trees directly in `find()`: `parent[i] = find(parent[i])`.

#### 13. Modified Binary Search & Search on Answer Space
* **`🔍 Search String`**: `Binary search on answer space monotonic predicate Koko eating bananas Java`
* **Core Concepts**: Standard binary search on rotated sorted arrays; Binary search on answer space where feasible range $[low, high]$ has a monotonic predicate condition $f(mid) == true$.
* **Canonical Problems**:
  * *Search in Rotated Sorted Array* (LeetCode 33)
  * *Find Minimum in Rotated Sorted Array* (LeetCode 153)
  * *Koko Eating Bananas* (LeetCode 875)
  * *Capacity To Ship Packages Within D Days* (LeetCode 1011)
* **Java Optimization**: Prevent integer overflow: `mid = low + (high - low) / 2`.

---

### Phase 4: Targeted Dynamic Programming & Advanced Search

#### 14. Canonical 1D Dynamic Programming
* **`🔍 Search String`**: `1D dynamic programming state transition space optimization Java house robber coin change`
* **Core Concepts**: Optimal substructure, overlapping subproblems, defining state $dp[i]$, deriving recurrence relation, optimizing space from $O(N)$ to $O(1)$ rolling variables.
* **Canonical Problems**:
  * *Climbing Stairs* (LeetCode 70)
  * *House Robber* (LeetCode 198)
  * *Coin Change* (LeetCode 322)
  * *Word Break* (LeetCode 139)
* **Java Optimization**: Replace $dp[]$ array with two scalar variables (`prev1`, `prev2`) whenever current state only depends on $i-1$ and $i-2$.

#### 15. 2D Grid Dynamic Programming
* **`🔍 Search String`**: `2D grid dynamic programming unique paths minimum path sum Java space optimization`
* **Core Concepts**: Grid navigation with path constraints, state $dp[i][j] = \min(dp[i-1][j], dp[i][j-1]) + grid[i][j]$, optimizing space to a single 1D row array.
* **Canonical Problems**:
  * *Unique Paths* (LeetCode 62)
  * *Minimum Path Sum* (LeetCode 64)
  * *Maximal Square* (LeetCode 221)
* **Java Optimization**: Roll 2D matrix into single 1D array of size $M$ (`dp[j] += dp[j-1]`).

#### 16. Subsequence & String Dynamic Programming
* **`🔍 Search String`**: `Longest common subsequence edit distance dynamic programming Java 2D table`
* **Core Concepts**: Comparing prefixes of two strings $S_1[i]$ and $S_2[j]$, match vs. mismatch transitions, insertion, deletion, and substitution operations.
* **Canonical Problems**:
  * *Longest Common Subsequence* (LeetCode 1143)
  * *Edit Distance* (LeetCode 72)
  * *Longest Increasing Subsequence* (LeetCode 300 — $O(N \log N)$ patience sorting)
* **Java Optimization**: For LIS, use Binary Search (`Arrays.binarySearch`) on tails array to achieve $O(N \log N)$ rather than $O(N^2)$ DP.

#### 17. Trie (Prefix Tree)
* **`🔍 Search String`**: `Implement Trie prefix tree Java character array wildcard search`
* **Core Concepts**: $N$-ary tree where nodes store character transitions, boolean `isEndOfWord` flag, $O(L)$ insertion and prefix lookup where $L$ is word length.
* **Canonical Problems**:
  * *Implement Trie (Prefix Tree)* (LeetCode 208)
  * *Design Add and Search Words Data Structure* (LeetCode 211)
* **Java Optimization**: Use `TrieNode[26] children` array instead of `HashMap<Character, TrieNode>` for lower memory footprint and instant array indexing.

#### 18. Backtracking with Pruning
* **`🔍 Search String`**: `Backtracking state space tree pruning combination sum subsets Java`
* **Core Concepts**: Recursive exploration of combinatorial search spaces, state mutation, recursive branch call, backtracking state undo, pruning invalid branches early.
* **Canonical Problems**:
  * *Subsets* (LeetCode 78)
  * *Combination Sum* (LeetCode 39)
  * *Word Search* (LeetCode 79)
* **Java Optimization**: Sort input array upfront to enable break/return pruning when current element exceeds remainder target.

---

## 4. Daily Execution Protocol

* **Time Slot**: Weekdays 9:00 AM – 10:00 AM (Post-gym, pre-work).
* **Target**: Exactly 1 LeetCode Medium problem under 30 minutes + 15 minutes of edge-case and complexity analysis.
* **The 5-Step Solution Checklist**:
  1. **Identify Pattern**: Articulate the naive approach ($O(N^2)$) vs. target pattern ($O(N)$ or $O(N \log N)$).
  2. **Boundary Scan**: Check integer overflow boundaries, $N=0$, $N=1$, negative values, duplicate elements.
  3. **Write Clean Code**: Idiomatic modern Java, descriptive variable names, zero boxing overhead.
  4. **Dry-Run Trace**: Walk through test case with pointer trace table on paper or scratchpad.
  5. **Commit Solution**: Push clean solution with comments and complexity to `github.com/harshansarvaiya/DSA`.
