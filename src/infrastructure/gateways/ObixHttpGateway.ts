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
    const points: SensorPoint[] = [];

    const res = await fetch(this.obixUrl, {
      method: "GET",
      headers: {
        Authorization: this.authHeader,
        Accept: "application/xml, text/xml, */*",
      },
    });

    if (!res.ok) {
      throw new Error(`oBIX returned HTTP Status ${res.status}: ${res.statusText}`);
    }

    const xmlText = await res.text();

    const errMatch = xmlText.match(/<err\b[^>]*>/i);
    if (errMatch) {
      const displayMatch = xmlText.match(/\bdisplay=["']([^"']+)["']/i);
      const isMatch = xmlText.match(/\bis=["']([^"']+)["']/i);
      const errDisplay = displayMatch ? displayMatch[1] : "Unknown oBIX error";
      const errType = isMatch ? isMatch[1] : "obix:Err";
      throw new Error(`oBIX Error (${errType}): ${errDisplay}`);
    }

    const driverFolderMatches = Array.from(
      xmlText.matchAll(/<ref\s+name="([^"]+)"[^>]*href="([^"]+)"/gi)
    );

    // If query targets Drivers root directly (e.g. .../config/Drivers/)
    if (this.obixUrl.toLowerCase().endsWith("/drivers/") && driverFolderMatches.length > 0) {
      for (const match of driverFolderMatches) {
        const devRawName = match[1];
        const devHref = match[2];

        if (devRawName.includes("ObixNetwork")) continue;

        const devCleanName = devRawName.replace(/\$20/g, " ").replace(/%20/g, " ");
        const deviceUrl = `${this.obixUrl}${devHref}`;

        try {
          const resDev = await fetch(deviceUrl, {
            method: "GET",
            headers: {
              Authorization: this.authHeader,
              Accept: "application/xml, text/xml, */*",
            },
          });

          if (resDev.ok) {
            const devXml = await resDev.text();
            const ptMatches = Array.from(
              devXml.matchAll(/<ref\s+name="([^"]+)"[^>]*display="([^"]+)"/gi)
            );

            for (const ptMatch of ptMatches) {
              const ptName = ptMatch[1];
              const displayStr = ptMatch[2];
              if (ptName.includes("Random")) continue;

              const pt = SensorPoint.evaluatePoint(devCleanName, ptName, displayStr);
              points.push(pt);
            }
          }
        } catch (e) {
          // Ignore subfolder fetch failures gracefully
        }
      }
    } else {
      // Direct driver/device folder (e.g. .../config/Drivers/Pump/)
      const cleanPath = this.obixUrl.replace(/\/$/, "");
      const segments = cleanPath.split("/");
      const deviceName = decodeURIComponent(segments[segments.length - 1].replace(/\$20/g, " "));

      const ptMatches = Array.from(
        xmlText.matchAll(/<ref\s+name="([^"]+)"[^>]*display="([^"]+)"/gi)
      );

      for (const ptMatch of ptMatches) {
        const ptName = ptMatch[1];
        const displayStr = ptMatch[2];
        if (ptName.includes("Random")) continue;

        const pt = SensorPoint.evaluatePoint(deviceName, ptName, displayStr);
        points.push(pt);
      }
    }

    if (points.length === 0) {
      const preview = xmlText.replace(/\s+/g, " ").trim().substring(0, 1000);
      console.warn(`[oBIX Debug] 0 points parsed. Response preview (${xmlText.length} chars): "${preview}"`);
    }

    return points;
  }
}
