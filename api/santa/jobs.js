import { handleJobs } from "../../sites/custom-letters-from-santa-claus/server/jobs.mjs";
import { nodeHandler } from "../../sites/custom-letters-from-santa-claus/server/node-http.mjs";

export const maxDuration = 60;
export default nodeHandler(handleJobs);
