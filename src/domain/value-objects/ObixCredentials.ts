export class ObixCredentials {
  private readonly username: string;
  private readonly password: string;

  constructor(username: string, password: string) {
    if (!username || !password) {
      throw new Error("Username and password must not be empty.");
    }
    this.username = username;
    this.password = password;
  }

  public toBasicAuthHeader(): string {
    const encoded = Buffer.from(`${this.username}:${this.password}`).toString("base64");
    return `Basic ${encoded}`;
  }
}

