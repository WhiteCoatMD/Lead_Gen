const login = document.querySelector("#login");
const queue = document.querySelector("#queue");
const orders = document.querySelector("#orders");
const loginStatus = login.querySelector(".status");

async function api(path, body) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function fieldList(order) {
  const bits = [
    `Order ${order.id}`,
    order.productName || order.slug,
    order.status,
    order.parentEmail,
  ];
  if (order.deliveryDate) bits.push(`Delivery ${order.deliveryDate}`);
  if (order.address?.street) bits.push(`${order.address.name}, ${order.address.street}, ${order.address.city}, ${order.address.state} ${order.address.zip}`);
  if (order.postmark) bits.push("Postmark add-on, hand fulfillment");
  return bits.filter(Boolean).join(" · ");
}

function childFor(order, draft) {
  return (order.children || []).find((child) => child.id === draft.childId);
}

function render(list) {
  orders.replaceChildren();
  if (!list.length) {
    orders.append(Object.assign(document.createElement("p"), { textContent: "No orders yet." }));
    return;
  }
  for (const order of list) {
    const article = document.createElement("article");
    const heading = document.createElement("h2");
    heading.textContent = order.productName || order.slug || "Order";
    article.append(heading);
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = fieldList(order);
    article.append(meta);
    const family = document.createElement("button");
    family.type = "button";
    family.className = "quiet";
    family.textContent = "Delete this family's data";
    family.addEventListener("click", async () => {
      if (!window.confirm("Delete this family's child details and contact information?")) return;
      try {
        await api("/api/santa/admin", { action: "delete_family", orderId: order.id });
        await load();
      } catch (error) {
        meta.textContent = error.message;
      }
    });
    article.append(family);
    for (const child of order.children || []) {
      const facts = document.createElement("p");
      facts.textContent = [child.firstName, child.age && `age ${child.age}`, child.town, child.friendOrPet, child.accomplishment, child.workOn, child.wishlist].filter(Boolean).join(" · ");
      article.append(facts);
    }
    for (const draft of order.drafts || []) {
      const block = document.createElement("div");
      const child = childFor(order, draft);
      const label = document.createElement("p");
      label.textContent = `${child?.firstName || "Letter"} · ${draft.status}${draft.source ? ` · ${draft.source}` : ""}`;
      block.append(label);
      if (draft.held) {
        const held = document.createElement("p");
        held.className = "held";
        held.textContent = "The delivery date has arrived and this letter is still unapproved. It will not be sent.";
        block.append(held);
      }
      if (draft.sendError) {
        const failed = document.createElement("p");
        failed.className = "held";
        failed.textContent = `Last send error: ${draft.sendError}`;
        block.append(failed);
      }
      const area = document.createElement("textarea");
      area.value = draft.body || "";
      area.setAttribute("aria-label", `Letter for ${child?.firstName || "this child"}`);
      block.append(area);
      const row = document.createElement("div");
      row.className = "row";
      const note = document.createElement("p");
      note.className = "status";
      note.setAttribute("role", "status");
      const actions = [["edit", "Save edit"], ["approve", "Approve"], ["reject", "Reject"], ["redraft", "Draft again"]];
      if (order.postmark && draft.status === "approved") actions.push(["mark_shipped", "Mark shipped"]);
      for (const [action, text] of actions) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = text;
        button.addEventListener("click", async () => {
          note.textContent = "";
          try {
            await api("/api/santa/admin", { action, draftId: draft.id, body: area.value });
            note.textContent = "Saved.";
            await load();
          } catch (error) {
            note.textContent = error.message;
          }
        });
        row.append(button);
      }
      block.append(row, note);
      article.append(block);
    }
    orders.append(article);
  }
}

async function load() {
  const data = await api("/api/santa/admin");
  login.hidden = true;
  queue.hidden = false;
  render(data.orders || []);
}

login.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "";
  try {
    await api("/api/santa/admin", { action: "login", password: new FormData(login).get("password") });
    await load();
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});

document.querySelector("#logout").addEventListener("click", async () => {
  await api("/api/santa/admin", { action: "logout" });
  queue.hidden = true;
  login.hidden = false;
});

load().catch(() => {});
