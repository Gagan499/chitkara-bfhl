require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

// Simple server setup: allow CORS from any origin, parse JSON, and serve the static frontend.
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.static("public"));

// Check that the input is a valid relation like A->B and not a self-loop.
function isValid(entry) {
  if (!/^[A-Z]->[A-Z]$/.test(entry)) return false;
  const [p, c] = entry.split("->");
  if (p === c) return false;
  return true;
}

// Depth-first search helper used to spot cycles in a directed graph.
function detectCycle(node, adj, visited, recStack) {
  visited.add(node);
  recStack.add(node);
  for (const child of adj[node] || []) {
    if (!visited.has(child)) {
      if (detectCycle(child, adj, visited, recStack)) return true;
    } else if (recStack.has(child)) {
      return true;
    }
  }
  recStack.delete(node);
  return false;
}

// Build a nested object for the subtree starting at this node.
function buildTree(node, adj) {
  const obj = {};
  for (const child of adj[node] || []) {
    obj[child] = buildTree(child, adj);
  }
  return obj;
}

// Compute the height of the tree from this node downward.
function calcDepth(node, adj) {
  const children = adj[node] || [];
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map((c) => calcDepth(c, adj)));
}

// Collect every node reachable from this starting root.
function getGroupNodes(root, adj) {
  const group = new Set();
  const queue = [root];
  while (queue.length) {
    const n = queue.shift();
    if (group.has(n)) continue;
    group.add(n);
    for (const ch of adj[n] || []) queue.push(ch);
  }
  return group;
}

app.post("/bfhl", (req, res) => {
  // Parse the incoming edges from the frontend.
  const inputData = req.body.data || [];

  const invalidEntries = [];
  const seenRelationships = new Set();
  const duplicateRelationshipsSet = new Set();
  const duplicateRelationships = [];
  const validRelationships = [];

  const insertedNodes = [];
  const seenNodes = new Set();

  // Keep nodes in the order they first appear, so output is predictable.
  function registerNode(node) {
    if (!seenNodes.has(node)) {
      seenNodes.add(node);
      insertedNodes.push(node);
    }
  }

  for (let entry of inputData) {
    let cleaned = String(entry)
      .trim()
      .replace(/^['"]+|['"]+$/g, "")
      .trim();

    if (!isValid(cleaned)) {
      invalidEntries.push(cleaned);
      continue;
    }

    if (seenRelationships.has(cleaned)) {
      if (!duplicateRelationshipsSet.has(cleaned)) {
        duplicateRelationshipsSet.add(cleaned);
        duplicateRelationships.push(cleaned);
      }
    } else {
      seenRelationships.add(cleaned);
      const [parent, child] = cleaned.split("->");
      registerNode(parent);
      registerNode(child);
      validRelationships.push({ parent, child, edge: cleaned });
    }
  }
  const adjacency = {};
  const parentMap = {};

  // Build graph edges, but only keep the first parent relationship we see for each child.
  for (const { parent, child } of validRelationships) {
    if (parentMap[child] !== undefined) continue;

    parentMap[child] = parent;
    if (!adjacency[parent]) adjacency[parent] = [];
    adjacency[parent].push(child);
  }

  const allNodeOrder = insertedNodes;

  // Roots are nodes that were never assigned a parent.
  const roots = allNodeOrder.filter((n) => parentMap[n] === undefined);

  const hierarchies = [];
  const globalVisited = new Set();

  for (const root of roots) {
    if (globalVisited.has(root)) continue;

    const group = getGroupNodes(root, adjacency);
    group.forEach((n) => globalVisited.add(n));

    const visited = new Set();
    const recStack = new Set();
    let cycleFound = false;

    for (const node of group) {
      if (!visited.has(node)) {
        if (detectCycle(node, adjacency, visited, recStack)) {
          cycleFound = true;
          break;
        }
      }
    }

    if (cycleFound) {
      // If the group has a cycle, we store a marker instead of a normal tree.
      hierarchies.push({ root, tree: {}, has_cycle: true });
    } else {
      const tree = { [root]: buildTree(root, adjacency) };
      const depth = calcDepth(root, adjacency);
      hierarchies.push({ root, tree, depth });
    }
  }
  const unprocessedNodes = allNodeOrder.filter((n) => !globalVisited.has(n));
  if (unprocessedNodes.length > 0) {
    const pureRoot = [...unprocessedNodes].sort()[0];
    hierarchies.push({ root: pureRoot, tree: {}, has_cycle: true });
  }

  const acyclicHierarchies = hierarchies.filter((h) => !h.has_cycle);
  const totalTrees = acyclicHierarchies.length;
  const totalCycles = hierarchies.filter((h) => h.has_cycle).length;

  let largestTreeRoot = "";
  let maxDepthValue = -1;
  for (const h of acyclicHierarchies) {
    if (
      h.depth > maxDepthValue ||
      (h.depth === maxDepthValue && h.root < largestTreeRoot)
    ) {
      maxDepthValue = h.depth;
      largestTreeRoot = h.root;
    }
  }

  res.json({
    user_id: process.env.USER_ID,
    email_id: process.env.EMAIL_ID,
    college_roll_number: process.env.COLLEGE_ROLL_NUMBER,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateRelationships,
    summary: {
      total_trees: totalTrees,
      total_cycles: totalCycles,
      largest_tree_root: largestTreeRoot,
    },
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`),
);
