import { Protocol } from "../deps.ts";

export interface SocketModeOptions {
  appToken?: string; // app level token
  logger?: Protocol;
  autoReconnectEnabled?: boolean;
  serverPingTimeout?: number;
}
