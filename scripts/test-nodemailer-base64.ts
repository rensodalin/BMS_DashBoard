import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';

async function testPdfAttachment() {
  const doc = new jsPDF();
  doc.text('Testing Intersys BMS Statement PDF', 15, 20);
  const dataUri = doc.output('datauristring');
  const base64Pdf = dataUri.split(',')[1];

  console.log('Generated base64 PDF length:', base64Pdf.length);

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: 'rrensodalin@gmail.com',
      pass: 'epsovhkaklzwcrqx',
    },
  });

  // Test sending with Buffer vs string
  const res = await transporter.sendMail({
    from: '"Intersys BMS" <rrensodalin@gmail.com>',
    to: 'rrensodalin@gmail.com',
    subject: 'PDF Attachment Test Verification',
    text: 'Please check if the attached PDF is visible and opens properly.',
    attachments: [
      {
        filename: 'Intersys_Utility_Statement.pdf',
        content: Buffer.from(base64Pdf, 'base64'),
        contentType: 'application/pdf',
      },
    ],
  });

  console.log('✅ Sent test email with PDF! Message ID:', res.messageId);
}

testPdfAttachment().catch(console.error);
