const result = document.querySelector("#result");
const contractsEl = document.querySelector("#contracts");
const reviewEl = document.querySelector("#reviewQueue");
const contractCount = document.querySelector("#contractCount");
const reviewCount = document.querySelector("#reviewCount");

document.querySelectorAll("[data-sample]").forEach((button) => {
  button.addEventListener("click", async () => {
    const sample = button.dataset.sample;
    button.disabled = true;
    renderResult(`Processing ${button.textContent}...`);
    try {
      const response = await fetch(`/demo/samples/${sample}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sample failed");
      renderDecision(data);
      await refresh();
    } catch (error) {
      renderResult(`Error: ${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  });
});

document.querySelector("#refreshBtn").addEventListener("click", refresh);

function renderResult(message, isError = false) {
  result.className = "result";
  result.innerHTML = `<span class="${isError ? "badge rejected" : ""}">${escapeHtml(message)}</span>`;
}

function renderDecision(data) {
  const route = data.route.route;
  result.className = "result";
  result.innerHTML = `
    <div class="route">
      <span class="badge ${route}">${route}</span>
      <strong>${escapeHtml(data.extraction.parties.counterpartyName || "Unknown counterparty")}</strong>
      <span>Confidence ${(data.extraction.confidence.overall * 100).toFixed(0)}%</span>
    </div>
    <ul class="reasons">${data.route.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
  `;
}

async function refresh() {
  const [contracts, reviews] = await Promise.all([
    fetchJson("/contracts"),
    fetchJson("/review-queue")
  ]);
  contractCount.textContent = contracts.length;
  reviewCount.textContent = reviews.length;
  contractsEl.innerHTML = contracts.length ? contracts.map(renderContract).join("") : empty("No contracts processed yet.");
  reviewEl.innerHTML = reviews.length ? reviews.map(renderReviewItem).join("") : empty("No review items.");
  wireReviewButtons();
}

function renderContract(contract) {
  const extraction = contract.extraction;
  return `
    <article class="card">
      <h3>${escapeHtml(extraction.parties.counterpartyName || "Unknown counterparty")}</h3>
      <p class="meta">
        ${escapeHtml(extraction.documentType)} ·
        confidence ${(extraction.confidence.overall * 100).toFixed(0)}% ·
        <span class="badge ${contract.route.route}">${contract.route.route}</span>
      </p>
      <p class="meta">Law: ${escapeHtml(extraction.contractDetails.governingLaw || "missing")}</p>
      <p class="meta">Risks: ${extraction.risks.length + contract.route.reasons.filter((reason) => reason.includes("risk")).length}</p>
    </article>
  `;
}

function renderReviewItem(item) {
  const extraction = item.contract?.extraction;
  return `
    <article class="card">
      <h3>${escapeHtml(extraction?.parties.counterpartyName || "Unknown counterparty")}</h3>
      <p class="meta">
        <span class="badge ${item.status}">${item.status}</span>
        Confidence ${(((extraction?.confidence.overall) || 0) * 100).toFixed(0)}%
      </p>
      <ul class="reasons">${item.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
      <details>
        <summary>RAG validation and evidence</summary>
        <pre>${escapeHtml(JSON.stringify(item.ragValidation, null, 2))}</pre>
      </details>
      ${
        item.status === "pending"
          ? `<div class="review-actions">
              <button data-review="${item.id}" data-action="approve" type="button">Approve</button>
              <button data-review="${item.id}" data-action="reject" type="button">Reject</button>
            </div>`
          : ""
      }
    </article>
  `;
}

function wireReviewButtons() {
  document.querySelectorAll("[data-review]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const id = button.dataset.review;
      const action = button.dataset.action;
      await fetchJson(`/review-queue/${id}/${action}`, { method: "POST" });
      await refresh();
    });
  });
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

function empty(text) {
  return `<p class="meta">${escapeHtml(text)}</p>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

refresh();
