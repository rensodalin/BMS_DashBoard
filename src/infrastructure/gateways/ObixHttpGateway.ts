import { IObixGateway } from "../../adapters/gateways/IObixGateway";
import { SensorPoint } from "../../domain/entities/SensorPoint";
import { ObixCredentials } from "../../domain/value-objects/ObixCredentials";

/**
 * Decode Niagara BFormat hex characters ($xx) and URI encoding
 * Examples: $31 -> "1", $32 -> "2", $20 -> " ", $33 -> "3"
 */
function decodeNiagaraName(s: string): string {
  if (!s) return "";
  let decoded = s.replace(/\$([0-9a-fA-F]{2})/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return hex;
    }
  });
  try {
    decoded = decodeURIComponent(decoded);
  } catch {}
  return decoded.trim();
}

/**
 * Dynamically extract standardized floor name from Niagara folder reference
 * e.g. <ref name="GF" ...> -> "Ground Floor"
 *      <ref name="$31F" displayName="1F" ...> -> "Floor 1"
 *      <ref name="$32F" displayName="2F" ...> -> "Floor 2"
 *      <ref name="$33F" displayName="3F" ...> -> "Floor 3"
 */
function detectFloorFromNiagaraRef(
  refName: string,
  displayName?: string,
  href?: string
): string | null {
  const rawDisplay = (displayName || "").trim();
  const decodedRef = decodeNiagaraName(refName);
  const candidate = rawDisplay || decodedRef || "";
  const clean = candidate.replace(/[-_]+/g, " ").trim();
  const lower = clean.toLowerCase();

  // Ground Floor
  if (
    lower === "gf" ||
    lower === "g" ||
    lower.startsWith("gf/") ||
    lower.includes("ground")
  ) {
    return "Ground Floor";
  }

  // 1F, First_Floor, First Floor, Floor 1, $31F
  if (
    lower.includes("first") ||
    lower.includes("1st") ||
    lower === "1f" ||
    lower === "$31f" ||
    lower === "floor 1" ||
    lower === "floor1" ||
    lower === "1"
  ) {
    return "Floor 1";
  }

  // 2F, Second_Floor, Second Floor, Floor 2, $32F
  if (
    lower.includes("second") ||
    lower.includes("2nd") ||
    lower === "2f" ||
    lower === "$32f" ||
    lower === "floor 2" ||
    lower === "floor2" ||
    lower === "2"
  ) {
    return "Floor 2";
  }

  // 3F, Third_Floor, Third Floor, Floor 3, $33F
  if (
    lower.includes("third") ||
    lower.includes("3rd") ||
    lower === "3f" ||
    lower === "$33f" ||
    lower === "floor 3" ||
    lower === "floor3" ||
    lower === "3"
  ) {
    return "Floor 3";
  }

  // 4F, Fourth_Floor
  if (
    lower.includes("fourth") ||
    lower.includes("4th") ||
    lower === "4f" ||
    lower === "$34f" ||
    lower === "floor 4" ||
    lower === "floor4" ||
    lower === "4"
  ) {
    return "Floor 4";
  }

  // Generic digit F matching: "5F" -> "Floor 5"
  const fMatch = lower.match(/^(\d+)\s*f$/i) || lower.match(/^f\s*(\d+)$/i);
  if (fMatch) {
    return `Floor ${fMatch[1]}`;
  }

  // Floor 1, Floor 2, etc.
  const floorMatch = lower.match(/^floor\s*(\d+)$/i);
  if (floorMatch) {
    return `Floor ${floorMatch[1]}`;
  }

  // Basements
  if (lower === "b1" || lower === "b2" || lower.includes("basement")) {
    return "Basement";
  }

  // Rooftop
  if (lower.includes("roof")) {
    return "Rooftop";
  }

  // Pure digits
  if (/^\d+$/.test(clean)) {
    return `Floor ${clean}`;
  }

  // If candidate is explicitly formatted or contains floor indicator
  if (lower.includes("floor")) {
    return clean
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return null;
}

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

    // Check if starting URL itself points to a specific floor folder (e.g. /GF/ or /First_Floor/)
    let initialFloor: string | undefined = undefined;
    const lastSegment = segments[segments.length - 1];
    if (
      lastSegment &&
      lastSegment.toLowerCase() !== "drivers" &&
      !lastSegment.toLowerCase().includes("billing")
    ) {
      initialFloor = decodeNiagaraName(lastSegment);
    }

    // Crawl starting from target obixUrl
    const points = await this.crawlUrl(this.obixUrl, defaultDeviceName, 0, initialFloor);

    // Strictly discard Niagara workspace metadata like wsAnnotation
    const validPoints = points.filter(
      (p) =>
        p.name &&
        !p.name.toLowerCase().includes("wsannotation") &&
        !p.name.toLowerCase().startsWith("ws")
    );

    if (validPoints.length === 0) {
      console.warn(`[oBIX Debug] 0 points parsed from: ${this.obixUrl}`);
    }

    return validPoints;
  }

  /**
   * Recursive crawler that fetches Niagara oBIX XML endpoints,
   * dynamically captures floor subfolders, ignores Niagara workspace meta,
   * and extracts actual sensor points with their detected floorName.
   */
  private async crawlUrl(
    targetUrl: string,
    deviceName: string,
    depth: number = 0,
    currentFloor?: string
  ): Promise<SensorPoint[]> {
    if (depth > 4) return []; // Prevent infinite recursion loops

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

      // Check if Niagara returned an error response
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
          const cleanPtName = decodeNiagaraName(ptSegment);
          const pt = SensorPoint.evaluatePoint(deviceName, cleanPtName, displayVal, currentFloor);
          points.push(pt);
          return points; // Leaf point captured; do not crawl proxyExt/ children
        }
      }

      // 1. Process <ref ...> tags with flexible attribute order and optional displayName
      const refMatches = Array.from(xmlText.matchAll(/<ref\b([^>]+)>/gi));

      for (const match of refMatches) {
        const attrs = match[1];
        const getAttr = (attr: string) => {
          const m = attrs.match(new RegExp(`\\b${attr}=["']([^"']+)["']`, "i"));
          return m ? m[1] : "";
        };

        const refName = getAttr("name");
        const href = getAttr("href");
        const displayStr = (getAttr("display") || "").trim();
        const displayName = (getAttr("displayName") || "").trim();
        const isType = getAttr("is");

        if (!refName && !href) continue;

        const lowerRef = refName.toLowerCase();
        if (
          lowerRef.includes("proxyext") ||
          lowerRef.includes("obixnetwork") ||
          lowerRef.includes("random") ||
          lowerRef.includes("wsannotation") ||
          lowerRef.startsWith("ws") ||
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
          isType.toLowerCase().includes("folder") ||
          (!displayStr && href.endsWith("/"));

        // 1. IF IT'S A FOLDER: Crawl inside it recursively and capture floor!
        if (isFolder) {
          const cleanRef = displayName || decodeNiagaraName(refName);

          // Direct subfolders under Billing System (depth === 0) ARE the floors!
          // e.g. "GF", "First_Floor", "Second_Floor"
          let nextFloor = currentFloor;
          if (depth === 0) {
            nextFloor = cleanRef;
          }

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

          const subPoints = await this.crawlUrl(subUrl, subDeviceName, depth + 1, nextFloor);
          points.push(...subPoints);
        }
        // 2. IF IT'S A SENSOR POINT (displayValue is not "Folder"): Evaluate point!
        else if (displayStr) {
          const cleanPtName = displayName || decodeNiagaraName(refName);
          const pt = SensorPoint.evaluatePoint(deviceName, cleanPtName, displayStr, currentFloor);
          points.push(pt);
        }
      }

      // 2. Also process direct Niagara primitive value tags: <real>, <bool>, <int>, <enum>, <str>
      const directMatches = Array.from(
        xmlText.matchAll(/<(real|bool|int|enum|str)\b([^>]+)>/gi)
      );

      for (const match of directMatches) {
        const attrs = match[2];
        const getAttr = (attr: string) => {
          const m = attrs.match(new RegExp(`\\b${attr}=["']([^"']+)["']`, "i"));
          return m ? m[1] : "";
        };

        const ptName = getAttr("name");
        const valAttr = getAttr("val");
        const displayAttr = getAttr("display");
        const displayName = getAttr("displayName");
        const displayStr = (displayAttr || valAttr).trim();
        const lowerPt = ptName.toLowerCase();

        if (
          !displayStr ||
          lowerPt.includes("obixnetwork") ||
          lowerPt.includes("random") ||
          lowerPt.includes("wsannotation") ||
          lowerPt.startsWith("ws")
        ) {
          continue;
        }

        const cleanPtName = displayName || decodeNiagaraName(ptName);

        if (!points.some((p) => p.name === cleanPtName)) {
          const pt = SensorPoint.evaluatePoint(deviceName, cleanPtName, displayStr, currentFloor);
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
