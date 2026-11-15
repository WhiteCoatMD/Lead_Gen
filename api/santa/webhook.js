import { handleWebhook } from "../../sites/custom-letters-from-santa-claus/server/webhook.mjs";
import { nodeHandler } from "../../sites/custom-letters-from-santa-claus/server/node-http.mjs";

export const config = { api: { bodyParser: false } };
export const maxDuration = 60;
export default nodeHandler(handleWebhook, { raw: true });
