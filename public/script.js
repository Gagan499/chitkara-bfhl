// Small helper to show results and keep the output panel styled nicely.
const API_URL = "https://gagandeepsingh-bhflherokuappcom.vercel.app";
function renderOutput(html) {
  document.getElementById("output").innerHTML =
    '<div class="card">' + html + "</div>";
}

// Reset the input box and clear any previous response.
function clearInput() {
  document.getElementById("input").value = "";
  document.getElementById("output").innerHTML = "";
}

async function submitData() {
  // Convert the textarea contents into a clean list of edges.
  const raw = document.getElementById("input").value;
  const data = raw
    .split(/[\n,]+/)
    .map((s) =>
      s
        .trim()
        .replace(/^['\"]+|['\"]+$/g, "")
        .trim(),
    )
    .filter(Boolean);

  if (!data.length) {
    renderOutput(
      '<p class="error">⚠️ Please enter at least one edge before submitting.</p>',
    );
    return;
  }

  try {
    const res = await fetch(API_URL + "/bfhl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    const json = await res.json();
    renderOutput("<pre>" + JSON.stringify(json, null, 2) + "</pre>");
  } catch (err) {
    renderOutput(
      '<p class="error">❌ API call failed: ' + err.message + "</p>",
    );
  }
}
