import { IObixGateway } from "../../adapters/gateways/IObixGateway";
import { SensorPoint } from "../../domain/entities/SensorPoint";
import { ObixCredentials } from "../../domain/value-objects/ObixCredentials";

export class ObixHttpGateway implements IObixGateway {
  private readonly obixUrl: string;
  private readonly authHeader: string;
  private readonly allowSelfSignedCert: boolean;

  constructor(
    obixUrl: string,
    username: string,
    pass: string,
    allowSelfSignedCert: boolean = true
  ) {
    this.obixUrl = obixUrl.endsWith("/") ? obixUrl : `${obixUrl}/`;
    this.allowSelfSignedCert = allowSelfSignedCert;
    const creds = new ObixCredentials(username, pass);
    this.authHeader = creds.toBasicAuthHeader();

    if (this.allowSelfSignedCert && this.obixUrl.startsWith("https://")) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
  }

  public async fetch10PointBatch(): Promise<SensorPoint[]> {
    // Extract base device name from URL path
    const cleanPath = this.obixUrl.replace(/\/$/, "");
    const segments = cleanPath.split("/");
    const driversIdx = segments.findIndex(
      (s) => s.toLowerCase() === "drivers"
    );

    let defaultDeviceName = "BMS";
    if (driversIdx !== -1 && driversIdx < segments.length - 1) {
      defaultDeviceName = decodeURIComponent(
        segments[driversIdx + 1].replace(/\$20/g, " ")
      );
    } else {
      defaultDeviceName = decodeURIComponent(
        segments[segments.length - 1].replace(/\$20/g, " ")
      );
    }

    // Crawl starting from target obixUrl
    const points = await this.crawlUrl(this.obixUrl, defaultDeviceName, 0);

    if (points.length === 0) {
      console.warn(`[oBIX Debug] 0 points parsed from: ${this.obixUrl}`);
    }

    return points;
  }

  /**
   * Recursive crawler that fetches Niagara oBIX XML endpoints,
   * ignores folders (`display="Folder"`), and extracts actual sensor points.
   */
  private async crawlUrl(
    targetUrl: string,
    deviceName: string,
    depth: number = 0
  ): Promise<SensorPoint[]> {
    if (depth > 3) return []; // Prevent infinite recursion loops

    const points: SensorPoint[] = [];
    const urlWithSlash = targetUrl.endsWith("/") ? targetUrl : `${targetUrl}/`;

    try {
      const res = await fetch(urlWithSlash, {
        method: "GET",
        headers: {
          Authorization: this.authHeader,
          Accept: "application/xml, text/xml, */*",
        },
      });

      if (!res.ok) return [];

      const xmlText = await res.text();

      // Check if Niagara returned an error response Start
      const errMatch = xmlText.match(/<err\b[^>]*>/i);
      if (errMatch && depth === 0) {
        const displayMatch = xmlText.match(/\bdisplay=["']([^"']+)["']/i);
        const isMatch = xmlText.match(/\bis=["']([^"']+)["']/i);
        const errDisplay = displayMatch ? displayMatch[1] : "Unknown oBIX error";
        const errType = isMatch ? isMatch[1] : "obix:Err";
        throw new Error(`oBIX Error (${errType}): ${errDisplay}`);
      }

      // Regex matching all <ref name="..." href="..." display="...">
      const matches = Array.from(
        xmlText.matchAll(/<ref\s+name="([^"]+)"[^>]*href="([^"]+)"(?:[^>]*display="([^"]+)")?/gi)
      );

      for (const match of matches) {
        const refName = match[1];
        const href = match[2];
        const displayStr = (match[3] || "").trim();

        if (refName.includes("ObixNetwork") || refName.includes("Random")) {
          continue;
        }

        const isFolderDisplay = displayStr.toLowerCase() === "folder";

        // 1. IF IT'S A FOLDER (display="Folder"): Crawl inside it recursively!
        if (isFolderDisplay || (href.endsWith("/") && !displayStr)) {
          const subDeviceName = depth === 0 && deviceName === "Drivers"
            ? refName.replace(/\$20/g, " ")
            : deviceName;

          const subUrl = href.startsWith("http")
            ? href
            : `${urlWithSlash}${href.replace(/^\//, "")}`;

          const subPoints = await this.crawlUrl(subUrl, subDeviceName, depth + 1);
          points.push(...subPoints);
        }
        // 2. IF IT'S A SENSOR POINT (displayValue is not "Folder"): Evaluate point!
        else if (displayStr && !isFolderDisplay) {
          const cleanPtName = refName.replace(/\$20/g, " ").replace(/%20/g, " ");
          const pt = SensorPoint.evaluatePoint(deviceName, cleanPtName, displayStr);
          points.push(pt);
        }
      }
    } catch (e: any) {
      if (depth === 0) {
        throw e;
      }
      // Ignore nested subfolder fetch errors
    }

    return points;
  }
}
