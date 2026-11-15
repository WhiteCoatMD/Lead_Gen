import { handleCheckout } from "../../sites/custom-letters-from-santa-claus/server/checkout.mjs";
import { nodeHandler } from "../../sites/custom-letters-from-santa-claus/server/node-http.mjs";

export const maxDuration = 30;
export default nodeHandler(handleCheckout);
