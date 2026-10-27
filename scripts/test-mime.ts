import nodemailer from 'nodemailer';

async function test() {
  const transporter = nodemailer.createTransport({
    streamTransport: true,
    buffer: true
  });

  const info: any = await transporter.sendMail({
    from: 'test@example.com',
    to: 'user@example.com',
    subject: 'Test',
    html: '<p>Hello</p><img src="cid:khqr-image" />',
    attachments: [
      { filename: 'invoice.pdf', content: Buffer.from('pdf content'), contentType: 'application/pdf' },
      { filename: 'qr.png', content: Buffer.from('fake png content'), contentType: 'image/png', cid: 'khqr-image' }
    ]
  });

  console.log(info.message.toString());
}

test().catch(console.error);
