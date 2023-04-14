export interface SocketModeOptions {
  appToken?: string; // app level token
  autoReconnectEnabled?: boolean;
  clientPingTimeout?: number;
  serverPingTimeout?: number;
  pingPongLoggingEnabled?: boolean;
}
