import { describe, expect, it } from "vitest";
import { validateCompanyProfile } from "@/lib/companyProfile";
import { getCompanyProfileLabels } from "@/lib/companyProfileLabels";

describe("getCompanyProfileLabels", () => {
  it("uses County for Kenya", () => {
    const labels = getCompanyProfileLabels("Kenya");
    expect(labels.stateLabel).toContain("County");
    expect(labels.stateRequired).toBe(true);
  });

  it("marks Singapore region as optional", () => {
    const labels = getCompanyProfileLabels("Singapore");
    expect(labels.stateRequired).toBe(false);
    expect(labels.stateLabel.toLowerCase()).toContain("optional");
  });
});

describe("validateCompanyProfile state rules", () => {
  it("allows blank region for Singapore", () => {
    const errors = validateCompanyProfile({
      companyName: "Acme Pte Ltd",
      legalName: "Acme Pte Ltd",
      businessAddress: "1 Raffles Place, Singapore",
      city: "Singapore",
      state: "",
      pincode: "018956",
      country: "Singapore",
    });
    expect(errors.state).toBeUndefined();
  });

  it("requires state for Kenya", () => {
    const errors = validateCompanyProfile({
      companyName: "Acme Ltd",
      legalName: "Acme Ltd",
      businessAddress: "Westlands Road, Nairobi",
      city: "Nairobi",
      state: "",
      pincode: "00100",
      country: "Kenya",
    });
    expect(errors.state).toBeTruthy();
  });
});
