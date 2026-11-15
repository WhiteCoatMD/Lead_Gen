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
    for (const child of order.children || []) {
      const facts = document.createElement("p");
      facts.textContent = [child.firstName, child.age && `age ${child.age}`, child.town, child.friendOrPet, child.accomplishment, child.workOn, child.wishlist].filter(Boolean).join(" · ");
      article.append(facts);
    }
    for (const draft of order.drafts || []) {
      const block = document.createElement("div");
      const child = childFor(order, draft);
      const label = document.createElement("p");
      label.textContent = `${child?.firstName || "Letter"} · ${draft.status}${draft.model ? ` · ${draft.model}` : ""}`;
      block.append(label);
      if (draft.held) {
        const held = document.createElement("p");
        held.className = "held";
        held.textContent = "The delivery date has arrived and this letter is still unapproved. It will not be sent.";
        block.append(held);
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
      for (const [action, text] of [["edit", "Save edit"], ["approve", "Approve"], ["reject", "Reject"], ["redraft", "Draft again"]]) {
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
