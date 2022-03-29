import { BaseResponse, ISlackAPIClient } from "./types.ts";

export class SlackAPIClient implements ISlackAPIClient {
  private token: string;
  private baseURL: string;

  constructor(token: string, baseURL?: string) {
    this.token = token;
    this.baseURL = baseURL || "https://slack.com/api/";
  }

  async call(
    method: string,
    data: Record<string, unknown>,
  ): Promise<BaseResponse> {
    const url = `${this.baseURL}${method}`;
    const body = serializeData(data);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw Error(`${resp.status}: ${text}`);
    }
    return await resp.json();
  }

  async response(
    url: string,
    data: Record<string, unknown>,
  ): Promise<BaseResponse> {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw Error(`${resp.status}: ${text}`);
    }
    return await resp.json();
  }
}

// Serialize an object into a string so as to be compatible with x-www-form-urlencoded payloads
export function serializeData(data: Record<string, unknown>): URLSearchParams {
  const encodedData: Record<string, string> = {};
  Object.entries(data).forEach(([key, value]) => {
    // Objects/arrays, numbers and booleans get stringified
    // Slack API accepts JSON-stringified-and-url-encoded payloads for objects/arrays
    // Inspired by https://github.com/slackapi/node-slack-sdk/blob/%40slack/web-api%406.7.1/packages/web-api/src/WebClient.ts#L452
    const serializedValue: string = typeof value !== "string"
      ? JSON.stringify(value)
      : value;
    encodedData[key] = serializedValue;
  });
  return new URLSearchParams(encodedData);
}