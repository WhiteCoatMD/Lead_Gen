import test from "node:test";
import assert from "node:assert/strict";
import { fallbackLetter, letterProblems, draftForChild } from "./draft.mjs";

const child = {
  firstName: "Ada",
  age: "7",
  town: "Grayson",
  friendOrPet: "Milo",
  accomplishment: "She learned to ride a bike",
  workOn: "waiting her turn",
  wishlist: "a red kite",
};

test("the fallback letter uses the form and does not promise gifts or a postmark", () => {
  const letter = fallbackLetter(child);
  assert.equal(letterProblems(letter).length, 0);
  assert.match(letter, /Dear Ada,/);
  assert.match(letter, /Grayson/);
  assert.match(letter, /waiting her turn/);
  assert.match(letter, /cannot promise/);
  assert.doesNotMatch(letter, /postmark|guarantee|you will get/i);
});

test("a model letter that invents a promise or misspells the name is replaced", async () => {
  const bad = await draftForChild(child, {
    generate: async () => "Dear Adah, I guarantee you will get a pony. It is postmarked from the North Pole USPS facility.",
  });
  assert.equal(bad.model, "fallback");
  assert.match(bad.body, /Dear Ada,/);
  assert.equal(letterProblems(bad.body).length, 0);
  const good = await draftForChild(child, {
    generate: async () => "Dear Ada,\n\nGrayson sounds like a good place to be 7. I cannot promise the kite. I am glad Milo is with you.\n\nSanta",
  });
  assert.match(good.body, /Dear Ada/);
  assert.notEqual(good.model, "fallback");
});
