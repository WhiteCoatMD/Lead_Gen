import { handleAdmin } from "../../sites/custom-letters-from-santa-claus/server/admin.mjs";
import { nodeHandler } from "../../sites/custom-letters-from-santa-claus/server/node-http.mjs";

export const maxDuration = 60;
export default nodeHandler(handleAdmin);
