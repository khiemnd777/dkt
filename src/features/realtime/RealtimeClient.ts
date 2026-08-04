import type { ClientMessage, ServerEvent } from "@shared/protocol";
import type { SessionRole } from "@shared/room";
import { ApiError, api } from "../../lib/api";

export type ConnectionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "FAILED";

export class RealtimeClient {
  private socket?: WebSocket;
  private stopped = false;
  private attempt = 0;
  private lastSequence = 0;
  private lastRoomStateVersion = 0;
  private awaitingSnapshot = false;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly roomCode: string,
    private readonly role: SessionRole,
    private readonly token: string,
    private readonly onEvent: (event: ServerEvent) => void,
    private readonly onState: (state: ConnectionState) => void,
  ) {}

  start(): void {
    this.stopped = false;
    void this.connect(false);
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close(1000, "Client closed");
    this.socket = undefined;
    this.onState("DISCONNECTED");
  }

  send(message: ClientMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  private async connect(reconnecting: boolean): Promise<void> {
    if (this.stopped) return;
    this.onState(reconnecting ? "RECONNECTING" : "CONNECTING");
    try {
      const { ticket } = await api.ticket(this.roomCode, this.role, this.token);
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(
        `${protocol}//${window.location.host}/api/rooms/${this.roomCode}/ws?ticket=${encodeURIComponent(ticket)}`,
      );
      this.socket = socket;
      socket.addEventListener("open", () => {
        this.attempt = 0;
        this.awaitingSnapshot = false;
        this.onState("CONNECTED");
      });
      socket.addEventListener("message", (message) => this.receive(message));
      socket.addEventListener("close", (event) => {
        if (this.socket !== socket || this.stopped) return;
        this.socket = undefined;
        if (event.code === 4404 || event.code === 4403) {
          this.onState("FAILED");
          return;
        }
        this.scheduleReconnect();
      });
      socket.addEventListener("error", () => socket.close());
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 404 || error.status === 409)
      ) {
        this.onState("FAILED");
        return;
      }
      this.scheduleReconnect();
    }
  }

  private receive(message: MessageEvent): void {
    if (typeof message.data !== "string") return;
    try {
      const event = JSON.parse(message.data) as ServerEvent;
      if (event.protocolVersion !== 1 || event.sequence <= this.lastSequence) return;
      const isSnapshot = event.type === "room.snapshot";
      if (
        !isSnapshot &&
        !this.awaitingSnapshot &&
        this.lastSequence > 0 &&
        event.sequence > this.lastSequence + 1
      ) {
        this.awaitingSnapshot = this.send({ type: "client.request_snapshot" });
      }
      this.lastSequence = event.sequence;
      if (event.roomStateVersion < this.lastRoomStateVersion) return;
      this.lastRoomStateVersion = event.roomStateVersion;
      if (isSnapshot) this.awaitingSnapshot = false;
      this.onEvent(event);
    } catch {
      // Invalid server data is ignored and cannot mutate the UI.
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.onState("RECONNECTING");
    const delays = [0, 500, 1_000, 2_000, 4_000, 8_000];
    const base = delays[Math.min(this.attempt, delays.length - 1)];
    const jitter = Math.floor(Math.random() * Math.max(100, base * 0.25));
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => void this.connect(true), base + jitter);
  }
}
