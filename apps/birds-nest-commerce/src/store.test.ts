import { describe,expect,it } from "vitest";
import { demoProducts,demoSettings } from "./demo";

describe("Bird's Nest store seed",()=>{
  it("keeps the current three products and valid prices",()=>{
    expect(demoProducts).toHaveLength(3);
    expect(demoProducts.every(product=>product.price_cents>0)).toBe(true);
    expect(new Set(demoProducts.map(product=>product.slug)).size).toBe(demoProducts.length);
  });
  it("does not enable checkout before a processor is selected",()=>{
    expect(demoSettings.payment_provider).toBe("none");
  });
});
