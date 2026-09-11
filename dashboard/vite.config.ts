import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import nodemailer from 'nodemailer'

function emailApiPlugin(): Plugin {
  return {
    name: 'email-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/send-email', (req, res) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer | string) => {
            body += chunk
          })
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              const {
                smtpUser,
                smtpPass,
                to,
                subject,
                html,
                text,
                attachments = [],
                fromName = 'Intersys BMS Billing',
              } = data

              const user = (smtpUser || process.env.VITE_GMAIL_USER || 'rrensodalin@gmail.com').trim()
              const pass = (smtpPass || process.env.VITE_GMAIL_APP_PASSWORD || 'epsovhkaklzwcrqx').replace(/\s+/g, '')

              if (!user || !pass) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Missing Gmail credentials' }))
                return
              }

              const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                  user,
                  pass,
                },
              })

              const formattedAttachments = attachments.map((att: { filename?: string; content: string; encoding?: string; contentType?: string; cid?: string }) => ({
                filename: att.filename || 'Utility_Invoice.pdf',
                content: att.content,
                encoding: att.encoding || 'base64',
                contentType: att.contentType || 'application/pdf',
                cid: att.cid,
              }))

              const info = await transporter.sendMail({
                from: `"${fromName}" <${user}>`,
                to: Array.isArray(to) ? to.join(', ') : to,
                subject: subject,
                text: text || '',
                html: html || undefined,
                attachments: formattedAttachments,
              })

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, messageId: info.messageId, recipient: to }))
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : 'Failed to send email via Gmail SMTP'
              console.error('[API Send Email Error]:', errorMessage)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: errorMessage }))
            }
          })
        } else {
          res.statusCode = 405
          res.end('Method Not Allowed')
        }
      })
    },
  }
}

interface DiscoveredPoint {
  pointName: string
  deviceName: string
  subfolder: string
  obixUrl: string
  currentValue: number
  displayVal?: string
  pointType: string
  floorName?: string
}

function decodeNiagaraBFormat(s: string): string {
  if (!s) return ''
  let decoded = s.replace(/\$([0-9a-fA-F]{2})/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16))
    } catch {
      return hex
    }
  })
  try {
    decoded = decodeURIComponent(decoded)
  } catch {}
  return decoded.trim()
}

function detectNiagaraFloor(refName: string, displayName?: string): string | null {
  const rawDisplay = (displayName || '').trim()
  const decodedRef = decodeNiagaraBFormat(refName)
  const candidate = rawDisplay || decodedRef || ''
  const clean = candidate.replace(/[-_]+/g, ' ').trim()
  const lower = clean.toLowerCase()

  if (lower === 'gf' || lower === 'g' || lower.startsWith('gf/') || lower.includes('ground')) return 'Ground Floor'
  if (lower.includes('first') || lower.includes('1st') || lower === '1f' || lower === '$31f' || lower === 'floor 1' || lower === 'floor1' || lower === '1') return 'Floor 1'
  if (lower.includes('second') || lower.includes('2nd') || lower === '2f' || lower === '$32f' || lower === 'floor 2' || lower === 'floor2' || lower === '2') return 'Floor 2'
  if (lower.includes('third') || lower.includes('3rd') || lower === '3f' || lower === '$33f' || lower === 'floor 3' || lower === 'floor3' || lower === '3') return 'Floor 3'
  if (lower.includes('fourth') || lower.includes('4th') || lower === '4f' || lower === '$34f' || lower === 'floor 4' || lower === 'floor4' || lower === '4') return 'Floor 4'

  const fMatch = lower.match(/^(\d+)\s*f$/i) || lower.match(/^f\s*(\d+)$/i)
  if (fMatch) return `Floor ${fMatch[1]}`
  const floorMatch = lower.match(/^floor\s*(\d+)$/i)
  if (floorMatch) return `Floor ${floorMatch[1]}`
  if (lower === 'b1' || lower === 'b2' || lower.includes('basement')) return 'Basement'
  if (lower.includes('roof')) return 'Rooftop'
  if (/^\d+$/.test(clean)) return `Floor ${clean}`
  if (lower.includes('floor')) {
    return clean.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
  return null
}

async function crawlObixFolder(
  targetUrl: string,
  username: string,
  pass: string,
  mockIfOffline = true
): Promise<{ success: boolean; folderUrl: string; total: number; points: DiscoveredPoint[]; simulated?: boolean }> {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  const urlWithSlash = targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`
  const authHeader = 'Basic ' + Buffer.from(`${username}:${pass}`).toString('base64')

  const points: DiscoveredPoint[] = []

  // Extract base site name
  const cleanPath = targetUrl.replace(/\/$/, '')
  const segments = cleanPath.split('/')
  const driversIdx = segments.findIndex((s) => s.toLowerCase() === 'drivers')
  const siteFolderName =
    driversIdx !== -1 && driversIdx < segments.length - 1
      ? decodeNiagaraBFormat(segments[driversIdx + 1])
      : decodeNiagaraBFormat(segments[segments.length - 1]) || 'Site'

  let initialFloor: string | undefined = undefined
  for (let i = segments.length - 1; i >= 0; i--) {
    const f = detectNiagaraFloor(segments[i], '')
    if (f) {
      initialFloor = f
      break
    }
  }

  async function crawl(url: string, currentSubfolder: string, depth: number, currentFloor?: string) {
    if (depth > 4) return
    const res = await fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(4500),
    })

    if (!res.ok) return
    const xml = await res.text()

    // Match <ref ...> tags with flexible attribute order
    const refMatches = Array.from(xml.matchAll(/<ref\b([^>]+)>/gi))

    for (const match of refMatches) {
      const attrs = match[1]
      const getAttr = (attr: string) => {
        const m = attrs.match(new RegExp(`\\b${attr}=["']([^"']+)["']`, 'i'))
        return m ? m[1] : ''
      }

      const refName = getAttr('name')
      const href = getAttr('href')
      const displayStr = (getAttr('display') || '').trim()
      const displayName = (getAttr('displayName') || '').trim()
      const isType = getAttr('is')

      if (!refName && !href) continue

      if (
        refName.includes('proxyExt') ||
        refName.includes('ObixNetwork') ||
        refName.includes('Random') ||
        refName.includes('wsAnnotation') ||
        refName.toLowerCase().startsWith('ws') ||
        refName === 'out' ||
        refName === 'in' ||
        refName === 'in16' ||
        refName === 'fallback' ||
        refName === 'status' ||
        refName === 'about' ||
        refName === 'batch' ||
        refName === 'watchService'
      ) {
        continue
      }

      const isFolder = displayStr.toLowerCase() === 'folder' || isType.toLowerCase().includes('folder') || (!displayStr && href.endsWith('/'))
      const cleanRef = displayName || decodeNiagaraBFormat(refName)

      let nextUrl: string
      try {
        nextUrl = new URL(href, url).toString()
      } catch {
        nextUrl = `${url}${href.replace(/^\//, '')}`
      }

      if (isFolder) {
        let nextFloor = currentFloor
        if (depth === 0) {
          nextFloor = cleanRef
        }

        const nextSubfolder = currentSubfolder ? `${currentSubfolder} / ${cleanRef}` : cleanRef
        await crawl(nextUrl.endsWith('/') ? nextUrl : `${nextUrl}/`, nextSubfolder, depth + 1, nextFloor)
      } else if (displayStr) {
        const numVal = parseFloat(displayStr.replace(/[^0-9.-]/g, ''))
        const val = isNaN(numVal) ? (displayStr.toLowerCase() === 'true' ? 1.0 : 0.0) : numVal
        const fullPointName = currentSubfolder ? `${currentSubfolder} - ${cleanRef}` : cleanRef

        points.push({
          pointName: fullPointName,
          deviceName: currentSubfolder || siteFolderName,
          subfolder: currentSubfolder || siteFolderName,
          obixUrl: nextUrl,
          currentValue: val,
          displayVal: displayStr,
          pointType: isNaN(numVal) ? 'boolean' : 'numeric',
          floorName: currentFloor,
        })
      }
    }

    // Direct primitive tags
    const directMatches = Array.from(
      xml.matchAll(/<(real|bool|int|enum|str)\b([^>]+)>/gi)
    )
    for (const match of directMatches) {
      const attrs = match[2]
      const getAttr = (attr: string) => {
        const m = attrs.match(new RegExp(`\\b${attr}=["']([^"']+)["']`, 'i'))
        return m ? m[1] : ''
      }

      const type = match[1].toLowerCase()
      const ptName = getAttr('name')
      const valAttr = getAttr('val')
      const displayAttr = getAttr('display')
      const displayName = getAttr('displayName')
      const displayStr = (displayAttr || valAttr).trim()

      if (!displayStr || !ptName || ptName.includes('ObixNetwork') || ptName.includes('Random') || ptName.includes('wsAnnotation') || ptName.toLowerCase().startsWith('ws')) continue

      const cleanPtName = displayName || decodeNiagaraBFormat(ptName)
      const fullPointName = currentSubfolder ? `${currentSubfolder} - ${cleanPtName}` : cleanPtName
      const numVal = parseFloat(displayStr.replace(/[^0-9.-]/g, ''))
      const val = isNaN(numVal) ? (displayStr.toLowerCase() === 'true' ? 1.0 : 0.0) : numVal

      if (!points.some((p) => p.pointName === fullPointName)) {
        points.push({
          pointName: fullPointName,
          deviceName: currentSubfolder || siteFolderName,
          subfolder: currentSubfolder || siteFolderName,
          obixUrl: url,
          currentValue: val,
          displayVal: displayStr,
          pointType: type,
          floorName: currentFloor,
        })
      }
    }
  }

  try {
    await crawl(urlWithSlash, '', 0, initialFloor)
  } catch (err) {
    console.warn(`[oBIX Live Crawl Notice]: ${err instanceof Error ? err.message : err}`)
  }

  if (points.length > 0) {
    return {
      success: true,
      folderUrl: targetUrl,
      total: points.length,
      points,
      simulated: false,
    }
  }

  if (mockIfOffline) {
    const isFloor1 = /floor[-_ ]*1\b/i.test(targetUrl)
    const isFloor2 = /floor[-_ ]*2\b/i.test(targetUrl)
    const isBillingSystem = /billing/i.test(targetUrl)

    const floor1Meters: DiscoveredPoint[] = [
      {
        pointName: 'Apple_Consumption',
        deviceName: 'floor1',
        subfolder: 'floor1',
        obixUrl: `${urlWithSlash}Apple_Consumption/`,
        currentValue: 1420.5,
        displayVal: '1420.5 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Banana_Consumption',
        deviceName: 'floor1',
        subfolder: 'floor1',
        obixUrl: `${urlWithSlash}Banana_Consumption/`,
        currentValue: 2130.2,
        displayVal: '2130.2 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Orange_Consumption',
        deviceName: 'floor1',
        subfolder: 'floor1',
        obixUrl: `${urlWithSlash}Orange_Consumption/`,
        currentValue: 1845.8,
        displayVal: '1845.8 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Kiwi_Consumption',
        deviceName: 'floor1',
        subfolder: 'floor1',
        obixUrl: `${urlWithSlash}Kiwi_Consumption/`,
        currentValue: 980.4,
        displayVal: '980.4 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Strawberry_Consumption',
        deviceName: 'floor1',
        subfolder: 'floor1',
        obixUrl: `${urlWithSlash}Strawberry_Consumption/`,
        currentValue: 3120.0,
        displayVal: '3120.0 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Durain_Consumption',
        deviceName: 'floor1',
        subfolder: 'floor1',
        obixUrl: `${urlWithSlash}Durain_Consumption/`,
        currentValue: 2750.6,
        displayVal: '2750.6 kWh',
        pointType: 'numeric',
      },
    ]

    const floor2Meters: DiscoveredPoint[] = [
      {
        pointName: 'Mango_Consumption',
        deviceName: 'floor2',
        subfolder: 'floor2',
        obixUrl: `${urlWithSlash}Mango_Consumption/`,
        currentValue: 1650.2,
        displayVal: '1650.2 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Melon_Consumption',
        deviceName: 'floor2',
        subfolder: 'floor2',
        obixUrl: `${urlWithSlash}Melon_Consumption/`,
        currentValue: 2480.0,
        displayVal: '2480.0 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Peach_Consumption',
        deviceName: 'floor2',
        subfolder: 'floor2',
        obixUrl: `${urlWithSlash}Peach_Consumption/`,
        currentValue: 1920.5,
        displayVal: '1920.5 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Cherry_Consumption',
        deviceName: 'floor2',
        subfolder: 'floor2',
        obixUrl: `${urlWithSlash}Cherry_Consumption/`,
        currentValue: 1150.8,
        displayVal: '1150.8 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Grape_Consumption',
        deviceName: 'floor2',
        subfolder: 'floor2',
        obixUrl: `${urlWithSlash}Grape_Consumption/`,
        currentValue: 2890.3,
        displayVal: '2890.3 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Papaya_Consumption',
        deviceName: 'floor2',
        subfolder: 'floor2',
        obixUrl: `${urlWithSlash}Papaya_Consumption/`,
        currentValue: 1430.7,
        displayVal: '1430.7 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Pineapple_Consumption',
        deviceName: 'floor2',
        subfolder: 'floor2',
        obixUrl: `${urlWithSlash}Pineapple_Consumption/`,
        currentValue: 3210.4,
        displayVal: '3210.4 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Coconut_Consumption',
        deviceName: 'floor2',
        subfolder: 'floor2',
        obixUrl: `${urlWithSlash}Coconut_Consumption/`,
        currentValue: 1870.9,
        displayVal: '1870.9 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Avocado_Consumption',
        deviceName: 'floor2',
        subfolder: 'floor2',
        obixUrl: `${urlWithSlash}Avocado_Consumption/`,
        currentValue: 2340.1,
        displayVal: '2340.1 kWh',
        pointType: 'numeric',
      },
      {
        pointName: 'Dragonfruit_Consumption',
        deviceName: 'floor2',
        subfolder: 'floor2',
        obixUrl: `${urlWithSlash}Dragonfruit_Consumption/`,
        currentValue: 2060.0,
        displayVal: '2060.0 kWh',
        pointType: 'numeric',
      },
    ]

    let generated: DiscoveredPoint[] = []
    if (isFloor1) {
      generated = floor1Meters
    } else if (isFloor2) {
      generated = floor2Meters
    } else if (isBillingSystem) {
      generated = [...floor1Meters, ...floor2Meters]
    } else {
      const mockSiteName = siteFolderName || 'Site'
      generated = [
        {
          pointName: `${mockSiteName} - AHU_01 - Supply_Air_Temp`,
          deviceName: `AHU_01`,
          subfolder: `AHU_01`,
          obixUrl: `${urlWithSlash}AHU_01/Supply_Air_Temp/`,
          currentValue: 23.8,
          displayVal: '23.8 °C',
          pointType: 'numeric',
        },
        {
          pointName: `${mockSiteName} - AHU_01 - Return_Air_Temp`,
          deviceName: `AHU_01`,
          subfolder: `AHU_01`,
          obixUrl: `${urlWithSlash}AHU_01/Return_Air_Temp/`,
          currentValue: 26.1,
          displayVal: '26.1 °C',
          pointType: 'numeric',
        },
        {
          pointName: `${mockSiteName} - AHU_01 - Fan_Run_Status`,
          deviceName: `AHU_01`,
          subfolder: `AHU_01`,
          obixUrl: `${urlWithSlash}AHU_01/Fan_Run_Status/`,
          currentValue: 1.0,
          displayVal: 'Run',
          pointType: 'boolean',
        },
        {
          pointName: `${mockSiteName} - AHU_01 - Filter_Alarm`,
          deviceName: `AHU_01`,
          subfolder: `AHU_01`,
          obixUrl: `${urlWithSlash}AHU_01/Filter_Alarm/`,
          currentValue: 0.0,
          displayVal: 'Normal',
          pointType: 'boolean',
        },
        {
          pointName: `${mockSiteName} - Chiller_01 - Leaving_Water_Temp`,
          deviceName: `Chiller_01`,
          subfolder: `Chiller_01`,
          obixUrl: `${urlWithSlash}Chiller_01/Leaving_Water_Temp/`,
          currentValue: 7.2,
          displayVal: '7.2 °C',
          pointType: 'numeric',
        },
        {
          pointName: `${mockSiteName} - Chiller_01 - Entering_Water_Temp`,
          deviceName: `Chiller_01`,
          subfolder: `Chiller_01`,
          obixUrl: `${urlWithSlash}Chiller_01/Entering_Water_Temp/`,
          currentValue: 12.4,
          displayVal: '12.4 °C',
          pointType: 'numeric',
        },
        {
          pointName: `${mockSiteName} - Chiller_01 - Compressor_Status`,
          deviceName: `Chiller_01`,
          subfolder: `Chiller_01`,
          obixUrl: `${urlWithSlash}Chiller_01/Compressor_Status/`,
          currentValue: 1.0,
          displayVal: 'Running',
          pointType: 'boolean',
        },
        {
          pointName: `${mockSiteName} - PowerMeter - Total_Active_Power`,
          deviceName: `PowerMeter`,
          subfolder: `PowerMeter`,
          obixUrl: `${urlWithSlash}PowerMeter/Total_Active_Power/`,
          currentValue: 48.6,
          displayVal: '48.6 kW',
          pointType: 'numeric',
        },
        {
          pointName: `${mockSiteName} - PowerMeter - Total_Active_Energy`,
          deviceName: `PowerMeter`,
          subfolder: `PowerMeter`,
          obixUrl: `${urlWithSlash}PowerMeter/Total_Active_Energy/`,
          currentValue: 15420.5,
          displayVal: '15420.5 kWh',
          pointType: 'numeric',
        },
        {
          pointName: `${mockSiteName} - Lighting - Zone1_Status`,
          deviceName: `Lighting`,
          subfolder: `Lighting`,
          obixUrl: `${urlWithSlash}Lighting/Zone1_Status/`,
          currentValue: 1.0,
          displayVal: 'ON',
          pointType: 'boolean',
        },
      ]
    }

    return {
      success: true,
      folderUrl: targetUrl,
      total: generated.length,
      points: generated,
      simulated: true,
    }
  }

  return {
    success: true,
    folderUrl: targetUrl,
    total: 0,
    points: [],
  }
}

function obixDiscoveryPlugin(): Plugin {
  return {
    name: 'obix-discovery-plugin',
    configureServer(server) {
      server.middlewares.use('/api/obix-discover', (req, res) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer | string) => {
            body += chunk
          })
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}')
              const {
                url,
                username = process.env.VITE_OBIX_USERNAME || process.env.OBIX_USERNAME || 'UserObix',
                password = process.env.VITE_OBIX_PASSWORD || process.env.OBIX_PASSWORD || 'UserObix12345',
                mockIfOffline = true,
              } = data

              if (!url) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'oBIX Folder URL is required' }))
                return
              }

              const result = await crawlObixFolder(url, username, password, mockIfOffline)
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : 'Discovery error'
              console.error('[API oBIX Discovery Error]:', errorMessage)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: errorMessage }))
            }
          })
        } else {
          res.statusCode = 405
          res.end('Method Not Allowed')
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), emailApiPlugin(), obixDiscoveryPlugin()],
})
