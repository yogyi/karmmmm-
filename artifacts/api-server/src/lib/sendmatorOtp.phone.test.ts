import { afterEach, describe, expect, it } from "vitest";
import { phoneOtpChannels } from "./sendmatorOtp";

describe("phoneOtpChannels", () => {
  const prev = process.env.SENDMATOR_PHONE_OTP_CHANNELS;

  afterEach(() => {
    if (prev === undefined) delete process.env.SENDMATOR_PHONE_OTP_CHANNELS;
    else process.env.SENDMATOR_PHONE_OTP_CHANNELS = prev;
  });

  it("defaults to WhatsApp + SMS for India/overseas delivery", () => {
    delete process.env.SENDMATOR_PHONE_OTP_CHANNELS;
    expect(phoneOtpChannels()).toEqual(["whatsapp", "sms"]);
  });

  it("can restrict to WhatsApp only", () => {
    process.env.SENDMATOR_PHONE_OTP_CHANNELS = "whatsapp";
    expect(phoneOtpChannels()).toEqual(["whatsapp"]);
  });
});
