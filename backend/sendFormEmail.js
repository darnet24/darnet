// backend/sendFormEmail.js
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post('/api/contact', async (req, res) => {
  const { name, email, message, zgodaMarketingowa, zgodaRODO } = req.body;

  if (!name || !email || !message || !zgodaRODO || zgodaRODO !== "true") {
    return res.status(400).json({
      success: false,
      message: "Zgoda RODO jest wymagana.",
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `Formularz darnet24.pl <${process.env.SMTP_USER}>`,
      to: process.env.RECEIVER_EMAIL,
      subject: 'Nowa wiadomość z formularza kontaktowego',
      html: `
        <p><strong>Imię i nazwisko:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Wiadomość:</strong><br/>${message.replace(/\n/g, '<br>')}</p>
        <p><strong>Zgoda marketingowa:</strong> ${zgodaMarketingowa ? 'Tak' : 'Nie'}</p>
      `,
    });

    res.status(200).json({ success: true, message: 'Wiadomość została wysłana.' });
  } catch (err) {
    console.error('Błąd wysyłki:', err);
    res.status(500).json({ success: false, message: 'Błąd serwera.' });
  }
});

app.listen(port, () => {
  console.log(`Serwer działa na http://localhost:${port}`);
});
