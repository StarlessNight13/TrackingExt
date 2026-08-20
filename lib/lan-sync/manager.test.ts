import { describe, expect, it } from "vitest";

import { isLanPeerOnline, adoptLanPairedConnection } from "./manager";

Object.assign(globalThis, {
  browser: {
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {},
      },
    },
  },
});

class FakePeerConnection extends EventTarget {
  connectionState: RTCPeerConnectionState = "connected";
  closed = false;

  close() {
    this.closed = true;
    this.connectionState = "closed";
    this.dispatchEvent(new Event("connectionstatechange"));
  }
}

class FakeDataChannel extends EventTarget {
  readyState: RTCDataChannelState = "connecting";

  send() {}

  open() {
    this.readyState = "open";
    this.dispatchEvent(new Event("open"));
  }

  close() {
    this.readyState = "closed";
    this.dispatchEvent(new Event("close"));
  }
}

describe("LAN connection lifecycle", () => {
  it("marks a peer offline when its active channel closes", () => {
    const peer = new FakePeerConnection();
    const channel = new FakeDataChannel();

    adoptLanPairedConnection(
      "peer-1",
      peer as unknown as RTCPeerConnection,
      channel as unknown as RTCDataChannel,
    );
    channel.open();
    expect(isLanPeerOnline("peer-1")).toBe(true);

    channel.close();
    expect(isLanPeerOnline("peer-1")).toBe(false);
  });

  it("keeps a replacement connection when the older connection closes", () => {
    const firstPeer = new FakePeerConnection();
    const firstChannel = new FakeDataChannel();
    const secondPeer = new FakePeerConnection();
    const secondChannel = new FakeDataChannel();

    adoptLanPairedConnection(
      "peer-2",
      firstPeer as unknown as RTCPeerConnection,
      firstChannel as unknown as RTCDataChannel,
    );
    adoptLanPairedConnection(
      "peer-2",
      secondPeer as unknown as RTCPeerConnection,
      secondChannel as unknown as RTCDataChannel,
    );
    secondChannel.open();

    expect(firstPeer.closed).toBe(true);
    expect(isLanPeerOnline("peer-2")).toBe(true);
  });
});
