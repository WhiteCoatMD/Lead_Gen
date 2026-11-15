import test from "node:test";
import assert from "node:assert/strict";
import { assertLobKey, lobPayload } from "./lob.mjs";

test("Lob stays on a test key and does not claim a postmark", () => {
  assert.throws(() => assertLobKey("live_abc"), /test API key/);
  assert.equal(assertLobKey("test_abc"), "test_abc");
  const payload = lobPayload({
    address: { name: "Pat Parent", street: "1 Main", city: "Grayson", state: "LA", zip: "71245" },
  }, { id: "draft-1", body: "Dear Ada,\n\nGrayson is home.\n\nSanta" }, {
    LOB_FROM_NAME: "Santa Claus",
    LOB_FROM_LINE1: "100 Main St",
    LOB_FROM_CITY: "Grayson",
    LOB_FROM_STATE: "LA",
    LOB_FROM_ZIP: "71245",
  });
  assert.equal(payload.mail_type, "usps_first_class");
  assert.doesNotMatch(payload.file, /postmark|usps facility/i);
  assert.throws(() => lobPayload({
    address: { name: "Pat", street: "1 Main", city: "Grayson", state: "LA", zip: "71245" },
  }, { id: "draft-2", body: "This letter has an official postmark." }, {
    LOB_FROM_NAME: "Santa",
    LOB_FROM_LINE1: "100 Main St",
    LOB_FROM_CITY: "Grayson",
    LOB_FROM_STATE: "LA",
    LOB_FROM_ZIP: "71245",
  }), /postmark/);
});
