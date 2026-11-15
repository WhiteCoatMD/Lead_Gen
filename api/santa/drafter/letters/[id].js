import { handleDrafter } from "../../../../sites/custom-letters-from-santa-claus/server/drafter.mjs";
import { nodeHandler } from "../../../../sites/custom-letters-from-santa-claus/server/node-http.mjs";

export default nodeHandler(handleDrafter);
