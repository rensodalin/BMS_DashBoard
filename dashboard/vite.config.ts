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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), emailApiPlugin()],
})
