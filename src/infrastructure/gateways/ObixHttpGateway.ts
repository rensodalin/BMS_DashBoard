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

      console.log(`[oBIX Crawl depth ${depth}] GET ${urlWithSlash} -> Status: ${res.status} ${res.statusText}`);

      if (!res.ok) {
        const bodySnippet = await res.text().catch(() => "");
        const titleMatch = bodySnippet.match(/<title>([^<]+)<\/title>/i);
        const reason = titleMatch ? titleMatch[1].trim() : res.statusText;
        console.error(`🚨 [oBIX Error] HTTP ${res.status} (${reason}) accessing: ${urlWithSlash}`);
        if (res.status === 403) {
          console.error(`👉 Tip: Niagara returned 403 Forbidden. Check category permissions for user 'UserObix' on this folder.`);
        }
        return [];
      }

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

      // Check if this URL itself is a Point with a value (e.g. Niagara NumericPoint <real>, <bool>, <int>, <enum>, <str>, <obj>)
      const rootPointMatch = xmlText.match(/<(real|bool|int|enum|str|obj)\b([^>]*)\/?>/i);
      if (rootPointMatch && depth > 0) {
        const rootAttrs = rootPointMatch[2];
        const isVal = (rootAttrs.match(/\bis=["']([^"']+)["']/i)?.[1] || "").toLowerCase();
        const rootDisplay = (rootAttrs.match(/\bdisplay=["']([^"']+)["']/i)?.[1] || "").trim();
        const rootVal = (rootAttrs.match(/\bval=["']([^"']+)["']/i)?.[1] || "").trim();
        const nameAttr = (rootAttrs.match(/\bname=["']([^"']+)["']/i)?.[1] || "").trim();
        const displayVal = rootDisplay || rootVal;

        if (displayVal && displayVal.toLowerCase() !== "folder" && !isVal.includes("folder")) {
          const ptSegment = nameAttr || targetUrl.replace(/\/$/, "").split("/").pop() || "Point";
          const cleanPtName = decodeURIComponent(ptSegment.replace(/\$20/g, " ").replace(/%20/g, " "));
          const pt = SensorPoint.evaluatePoint(deviceName, cleanPtName, displayVal);
          points.push(pt);
          return points; // Leaf point captured; do not crawl proxyExt/ children
        }
      }

      // 1. Process <ref name="..." href="..." display="...">
      const refMatches = Array.from(
        xmlText.matchAll(/<ref\s+[^>]*name="([^"]+)"[^>]*href="([^"]+)"(?:[^>]*display="([^"]+)")?/gi)
      );

      for (const match of refMatches) {
        const refName = match[1];
        const href = match[2];
        const displayStr = (match[3] || "").trim();

        if (
          refName.includes("proxyExt") ||
          refName.includes("ObixNetwork") ||
          refName.includes("Random") ||
          refName === "out" ||
          refName === "in" ||
          refName === "in16" ||
          refName === "fallback" ||
          refName === "status" ||
          refName === "about" ||
          refName === "batch" ||
          refName === "watchService"
        ) {
          continue;
        }

        const isFolder =
          displayStr.toLowerCase() === "folder" ||
          (!displayStr && href.endsWith("/"));

        // 1. IF IT'S A FOLDER: Crawl inside it recursively!
        if (isFolder) {
          const cleanRef = refName.replace(/\$20/g, " ").replace(/%20/g, " ");
          const subDeviceName =
            depth === 0
              ? (deviceName === "Drivers" ? cleanRef : `${deviceName} - ${cleanRef}`)
              : `${deviceName} - ${cleanRef}`;

          let subUrl: string;
          try {
            subUrl = new URL(href, urlWithSlash).toString();
          } catch {
            subUrl = `${urlWithSlash}${href.replace(/^\//, "")}`;
          }

          const subPoints = await this.crawlUrl(subUrl, subDeviceName, depth + 1);
          points.push(...subPoints);
        }
        // 2. IF IT'S A SENSOR POINT (displayValue is not "Folder"): Evaluate point!
        else if (displayStr) {
          const cleanPtName = refName.replace(/\$20/g, " ").replace(/%20/g, " ");
          const pt = SensorPoint.evaluatePoint(deviceName, cleanPtName, displayStr);
          points.push(pt);
        }
      }

      // 2. Also process direct Niagara primitive value tags: <real>, <bool>, <int>, <enum>, <str>
      const directMatches = Array.from(
        xmlText.matchAll(/<(real|bool|int|enum|str)\s+[^>]*name="([^"]+)"(?:[^>]*val="([^"]+)")?(?:[^>]*display="([^"]+)")?/gi)
      );

      for (const match of directMatches) {
        const ptName = match[2];
        const valAttr = match[3] || "";
        const displayAttr = match[4] || "";
        const displayStr = (displayAttr || valAttr).trim();

        if (!displayStr || ptName.includes("ObixNetwork") || ptName.includes("Random")) {
          continue;
        }

        const cleanPtName = ptName.replace(/\$20/g, " ").replace(/%20/g, " ");
        if (!points.some((p) => p.name === cleanPtName)) {
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
