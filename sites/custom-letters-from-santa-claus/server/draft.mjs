import { DEFAULT_MODEL } from "./config.mjs";

// Warm Santa voice, only the facts the parent typed. No guaranteed gifts and
// no postmark claim. The envelope is a separate decision from the letter.

const BLOCKED = [
  [/\bguarantee/i, "a guaranteed gift"],
  [/\bi promise\b/i, "a promise"],
  [/\byou will get\b/i, "a promised gift"],
  [/\bpostmark\b/i, "a postmark claim"],
  [/usps facility/i, "a USPS facility claim"],
  [/north pole usps/i, "a USPS facility claim"],
];

export function letterProblems(text) {
  const problems = [];
  for (const [pattern, why] of BLOCKED) {
    if (pattern.test(String(text || ""))) problems.push(why);
  }
  return problems;
}

export function buildPrompt(child) {
  return [
    "You write a short letter from Santa Claus to one child.",
    "Voice: warm, specific, and kind. Plain sentences.",
    "Use only the facts below. Do not invent relatives, pets, events, or gifts.",
    "Spell the child's name exactly as given.",
    "If a working-on note is present, encourage. Do not scold.",
    "Do not promise gifts. Do not say you guarantee anything. Do not say they will get what they wished for.",
    "Do not mention a postmark, the USPS, or a North Pole post office.",
    "",
    `Name: ${child.firstName}`,
    `Age: ${child.age}`,
    `Town: ${child.town}`,
    `Friend or pet: ${child.friendOrPet || "(none given)"}`,
    `Accomplishment: ${child.accomplishment || "(none given)"}`,
    `Working on: ${child.workOn || "(none given)"}`,
    `Wish list: ${child.wishlist || "(none given)"}`,
  ].join("\n");
}

export function fallbackLetter(child) {
  const lines = [
    `Dear ${child.firstName},`,
    "",
    `Merry Christmas. I am glad to write to you in ${child.town}. You are ${child.age}, and I like knowing that.`,
  ];
  if (child.accomplishment) lines.push("", `I heard about this: ${child.accomplishment}. That took heart.`);
  if (child.friendOrPet) lines.push("", `${child.friendOrPet} is part of your days, and that is a good thing.`);
  if (child.workOn) lines.push("", `You are working on ${child.workOn}. I am proud of you for trying. Keep at it kindly.`);
  if (child.wishlist) lines.push("", `I read what you are hoping for: ${child.wishlist}. I cannot promise those wishes. I am glad to know what matters to you.`);
  lines.push("", "With love,", "Santa");
  return lines.join("\n");
}

function hasExact(text, value) {
  if (!value) return true;
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "u").test(text);
}

export function acceptsModel(text, child) {
  const body = String(text || "").trim();
  if (!body || body.length > 4000) return false;
  if (!hasExact(body, child.firstName)) return false;
  if (child.town && !body.includes(child.town)) return false;
  return letterProblems(body).length === 0;
}

export async function draftForChild(child, { generate, model = DEFAULT_MODEL } = {}) {
  try {
    const text = await generate(buildPrompt(child));
    if (acceptsModel(text, child)) return { body: String(text).trim(), model };
  } catch {
    // The safe letter below still goes to the review queue. Nothing is sent.
  }
  return { body: fallbackLetter(child), model: "fallback" };
}

export async function generateWithGateway(prompt, env = process.env) {
  if (!env.AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY is not set");
  const { generateText } = await import("ai");
  const { text } = await generateText({
    model: env.AI_GATEWAY_MODEL || DEFAULT_MODEL,
    prompt,
    maxRetries: 0,
    timeout: 20000,
  });
  return text;
}
